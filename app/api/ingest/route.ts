// ═══════════════════════════════════════════════════════════════
// INGEST API
// Receives posts from the browser-based poller running on
// truthsocial.com and feeds them into the analysis pipeline
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { eventBus } from "@/lib/event-bus";
import { store } from "@/lib/store";
import { analyzePost } from "@/lib/analyzer";
import { executeTrade } from "@/lib/trader";
import { getConfig } from "@/lib/config";
import { logger } from "@/lib/logger";
import type { TruthPost } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

const MODULE = "Ingest";

// Track seen post IDs to avoid reprocessing
const seenPostIds = new Set<string>();

async function processPipeline(post: TruthPost) {
  const startMs = Date.now();
  logger.info(MODULE, `═══ Processing post ${post.id} ═══`);
  logger.info(MODULE, `Content: "${post.content.substring(0, 120)}..."`);

  // Store the post
  store.addPost(post);
  eventBus.emit("new-post", { post });

  // Analyze with Claude
  const analysisResult = await analyzePost(post);

  if (!analysisResult.success || !analysisResult.analysis) {
    logger.error(MODULE, `Analysis failed: ${analysisResult.error}`);
    store.addError({
      timestamp: new Date().toISOString(),
      module: MODULE,
      message: `Analysis failed: ${analysisResult.error}`,
    });
    eventBus.emit("analysis-error", { postId: post.id, error: analysisResult.error });
    return { analyzed: false, error: analysisResult.error };
  }

  const analysis = analysisResult.analysis;
  store.addAnalysis(analysis);

  logger.signal(
    MODULE,
    `Impact: ${analysis.impact} | Direction: ${analysis.direction} | Confidence: ${analysis.confidence} | Instrument: ${analysis.primaryInstrument}`
  );

  eventBus.emit("analysis-complete", { post, analysis });

  // Check if trade warranted
  const config = getConfig();
  let tradeResult = null;

  if (
    analysis.recommendedTrade.action !== "none" &&
    analysis.impact !== "none" &&
    analysis.impact !== "low" &&
    analysis.confidence >= config.confidenceThreshold
  ) {
    logger.trade(
      MODULE,
      `Executing: ${analysis.recommendedTrade.action} ${analysis.recommendedTrade.instrument}`
    );

    const tradeRecord = await executeTrade(analysis, post);
    store.addTrade(tradeRecord);
    tradeResult = tradeRecord;

    eventBus.emit("trade-executed", { post, analysis, trade: tradeRecord });
  }

  const totalMs = Date.now() - startMs;
  logger.info(MODULE, `Pipeline complete in ${totalMs}ms`);

  return {
    analyzed: true,
    analysis: {
      impact: analysis.impact,
      direction: analysis.direction,
      confidence: analysis.confidence,
      instrument: analysis.primaryInstrument,
      action: analysis.recommendedTrade.action,
      reasoning: analysis.reasoning,
      latencyMs: analysis.latencyMs,
    },
    trade: tradeResult
      ? { status: tradeResult.status, contract: tradeResult.contractSymbol }
      : null,
    totalMs,
  };
}

export async function POST(request: Request) {
  try {
    // Handle both application/json and text/plain (sendBeacon sends text/plain)
    const contentType = request.headers.get("content-type") || "";
    let body: unknown;
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      body = JSON.parse(text);
    }

    // Accept single post or array of posts
    const rawPosts: Array<{
      id: string;
      created_at: string;
      content: string;
      url: string;
      reblog?: { id: string; content: string; account?: { display_name: string } } | null;
      media_attachments?: Array<{ type: string; url: string; preview_url?: string; description?: string }>;
    }> = Array.isArray(body) ? body : body.posts ? body.posts : [body];

    const results = [];

    for (const raw of rawPosts) {
      // Dedup
      if (seenPostIds.has(raw.id)) {
        results.push({ id: raw.id, status: "duplicate" });
        continue;
      }
      seenPostIds.add(raw.id);

      // Keep set bounded
      if (seenPostIds.size > 5000) {
        const arr = Array.from(seenPostIds);
        arr.splice(0, 1000);
        seenPostIds.clear();
        arr.forEach((id) => seenPostIds.add(id));
      }

      // Strip HTML
      const stripHtml = (html: string) =>
        html
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>\s*<p>/gi, "\n\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ")
          .trim();

      const isRepost = !!raw.reblog;
      const source = isRepost && raw.reblog ? raw.reblog : raw;

      const post: TruthPost = {
        id: raw.id,
        createdAt: raw.created_at,
        content: stripHtml(typeof source.content === "string" ? source.content : ""),
        contentHtml: typeof source.content === "string" ? source.content : "",
        url: raw.url || `https://truthsocial.com/@realDonaldTrump/${raw.id}`,
        isRepost,
        repostAuthor: isRepost && raw.reblog?.account?.display_name
          ? raw.reblog.account.display_name
          : undefined,
        mediaAttachments: (raw.media_attachments || []).map((m) => ({
          type: (m.type as "image" | "video" | "gifv" | "audio" | "unknown") || "unknown",
          url: m.url,
          previewUrl: m.preview_url,
          description: m.description || undefined,
        })),
        detectedAt: new Date().toISOString(),
      };

      // Skip empty posts
      if (!post.content.trim()) {
        results.push({ id: raw.id, status: "empty" });
        continue;
      }

      // Process through pipeline
      const pipelineResult = await processPipeline(post);
      results.push({ id: raw.id, status: "processed", ...pipelineResult });
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(MODULE, `Ingest error: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// CORS headers for browser-based poller
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

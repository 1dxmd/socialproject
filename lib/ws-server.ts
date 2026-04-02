// ═══════════════════════════════════════════════════════════════
// WEBSOCKET SERVER
// Runs alongside Next.js to receive posts from the browser poller
// Chrome allows WebSocket connections from HTTPS → ws://localhost
// (unlike fetch which blocks HTTPS → HTTP)
// ═══════════════════════════════════════════════════════════════

import { WebSocketServer, WebSocket } from "ws";
import { logger } from "@/lib/logger";
import { eventBus } from "@/lib/event-bus";
import { store } from "@/lib/store";
import { analyzePost } from "@/lib/analyzer";
import { executeTrade } from "@/lib/trader";
import { getConfig } from "@/lib/config";
import type { TruthPost } from "@/lib/monitor/types";

const MODULE = "WS";
const seenPostIds = new Set<string>();

function stripHtml(html: string): string {
  return html
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
}

async function processPost(raw: {
  id: string;
  created_at: string;
  content: string;
  url: string;
  reblog?: { content: string; account?: { display_name: string } } | null;
  media_attachments?: Array<{ type: string; url: string; preview_url?: string; description?: string }>;
}, ws: WebSocket) {
  if (seenPostIds.has(raw.id)) return;
  seenPostIds.add(raw.id);

  const isRepost = !!raw.reblog;
  const source = isRepost && raw.reblog ? raw.reblog : raw;

  const post: TruthPost = {
    id: raw.id,
    createdAt: raw.created_at,
    content: stripHtml(source.content || ""),
    contentHtml: source.content || "",
    url: raw.url || `https://truthsocial.com/@realDonaldTrump/${raw.id}`,
    isRepost,
    repostAuthor: isRepost && raw.reblog?.account?.display_name || undefined,
    mediaAttachments: (raw.media_attachments || []).map((m) => ({
      type: (m.type as "image" | "video" | "gifv" | "audio" | "unknown") || "unknown",
      url: m.url,
      previewUrl: m.preview_url,
      description: m.description || undefined,
    })),
    detectedAt: new Date().toISOString(),
  };

  if (!post.content.trim()) return;

  store.addPost(post);
  eventBus.emit("new-post", { post });

  // Analyze
  const result = await analyzePost(post);
  if (result.success && result.analysis) {
    store.addAnalysis(result.analysis);
    eventBus.emit("analysis-complete", { post, analysis: result.analysis });

    // Send analysis back to browser
    ws.send(JSON.stringify({
      type: "analysis",
      postId: raw.id,
      analysis: {
        impact: result.analysis.impact,
        direction: result.analysis.direction,
        confidence: result.analysis.confidence,
        instrument: result.analysis.primaryInstrument,
        action: result.analysis.recommendedTrade.action,
        reasoning: result.analysis.reasoning,
        latencyMs: result.analysis.latencyMs,
      },
    }));

    // Execute trade if warranted
    const config = getConfig();
    if (
      result.analysis.recommendedTrade.action !== "none" &&
      result.analysis.impact !== "none" &&
      result.analysis.impact !== "low" &&
      result.analysis.confidence >= config.confidenceThreshold
    ) {
      const trade = await executeTrade(result.analysis, post);
      store.addTrade(trade);
      eventBus.emit("trade-executed", { post, analysis: result.analysis, trade });

      ws.send(JSON.stringify({
        type: "trade",
        postId: raw.id,
        trade: { status: trade.status, contract: trade.contractSymbol },
      }));
    }
  }
}

let wss: WebSocketServer | null = null;

export function startWSServer(port: number = 3002) {
  if (wss) return wss;

  wss = new WebSocketServer({ port });

  wss.on("listening", () => {
    logger.info(MODULE, `WebSocket server listening on ws://localhost:${port}`);
  });

  wss.on("connection", (ws) => {
    logger.info(MODULE, "Browser poller connected");

    ws.send(JSON.stringify({ type: "connected", message: "SocialProject WS ready" }));

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "posts" && Array.isArray(msg.posts)) {
          logger.info(MODULE, `Received ${msg.posts.length} post(s) from browser`);
          for (const post of msg.posts) {
            await processPost(post, ws);
          }
        }

        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (err) {
        logger.error(MODULE, `Message parse error: ${err}`);
      }
    });

    ws.on("close", () => {
      logger.info(MODULE, "Browser poller disconnected");
    });
  });

  wss.on("error", (err) => {
    logger.error(MODULE, `WebSocket error: ${err.message}`);
  });

  return wss;
}

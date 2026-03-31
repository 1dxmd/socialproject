// ═══════════════════════════════════════════════════════════════
// ANALYZER SERVICE
// Sends Trump posts to Claude API for market impact analysis
// Uses structured prompts with few-shot examples for accuracy
// ═══════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";
import { getConfig } from "@/lib/config";
import { SYSTEM_PROMPT, FEW_SHOT_EXAMPLES, buildUserMessage } from "./prompt";
import { parseAnalysisResponse } from "./parser";
import type { Analysis, AnalysisResult } from "./types";
import type { TruthPost } from "@/lib/monitor/types";

const MODULE = "Analyzer";

// Keep recent analyses for context
let recentPosts: Array<{ text: string; time: string }> = [];
const MAX_RECENT = 5;

function getMarketStatus(): string {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const day = et.getDay();
  const timeMinutes = hours * 60 + minutes;

  if (day === 0 || day === 6) return "closed (weekend)";
  if (timeMinutes < 4 * 60) return "closed (overnight)";
  if (timeMinutes < 9 * 60 + 30) return "pre-market";
  if (timeMinutes < 16 * 60) return "open";
  if (timeMinutes < 20 * 60) return "after-hours";
  return "closed";
}

function buildRecentContext(): string {
  if (recentPosts.length === 0) return "";
  return recentPosts
    .slice(-3)
    .map((p) => `[${p.time}] ${p.text.substring(0, 150)}`)
    .join("\n");
}

export async function analyzePost(post: TruthPost): Promise<AnalysisResult> {
  const config = getConfig();

  if (!config.anthropicApiKey) {
    return { success: false, error: "ANTHROPIC_API_KEY not configured" };
  }

  const startMs = Date.now();
  logger.info(MODULE, `Analyzing post ${post.id}: "${post.content.substring(0, 80)}..."`);

  try {
    const client = new Anthropic({ apiKey: config.anthropicApiKey });

    const userMessage = buildUserMessage(
      post.content,
      post.createdAt,
      post.isRepost,
      getMarketStatus(),
      buildRecentContext()
    );

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      temperature: 0,
      system: `${SYSTEM_PROMPT}\n\n${FEW_SHOT_EXAMPLES}`,
      messages: [{ role: "user", content: userMessage }],
    });

    const latencyMs = Date.now() - startMs;
    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    logger.info(MODULE, `Claude responded in ${latencyMs}ms`);

    // Parse and validate
    const { analysis, error } = parseAnalysisResponse(rawText, post.id, latencyMs);

    if (error) {
      logger.warn(MODULE, `Parse error, retrying: ${error}`);

      // Retry once with stricter instruction
      const retryResponse = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        temperature: 0,
        system: `${SYSTEM_PROMPT}\n\n${FEW_SHOT_EXAMPLES}\n\nCRITICAL: Your previous response was not valid JSON. You MUST respond with ONLY a raw JSON object. No markdown, no backticks, no text before or after.`,
        messages: [{ role: "user", content: userMessage }],
      });

      const retryText =
        retryResponse.content[0].type === "text"
          ? retryResponse.content[0].text
          : "";
      const retryResult = parseAnalysisResponse(retryText, post.id, Date.now() - startMs);

      if (retryResult.error) {
        return {
          success: false,
          error: `Retry parse also failed: ${retryResult.error}`,
          rawResponse: retryText,
        };
      }

      // Track recent post for context
      recentPosts.push({ text: post.content, time: post.createdAt });
      if (recentPosts.length > MAX_RECENT) recentPosts.shift();

      return { success: true, analysis: retryResult.analysis };
    }

    // Track recent post for context
    recentPosts.push({ text: post.content, time: post.createdAt });
    if (recentPosts.length > MAX_RECENT) recentPosts.shift();

    return { success: true, analysis, rawResponse: rawText };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(MODULE, `Claude API error: ${message}`);
    return { success: false, error: message };
  }
}

export type { Analysis, AnalysisResult };

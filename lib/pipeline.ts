// ═══════════════════════════════════════════════════════════════
// PIPELINE — The Main Engine
// Post detected → Claude analysis → Risk check → Trade execution
// Target: <3 seconds from post to order placement
// ═══════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import { eventBus } from "@/lib/event-bus";
import { getConfig } from "@/lib/config";
import { monitorService } from "@/lib/monitor";
import { analyzePost } from "@/lib/analyzer";
import { executeTrade } from "@/lib/trader";
import { store } from "@/lib/store";
import type { TruthPost } from "@/lib/monitor/types";

const MODULE = "Pipeline";

// Processing queue to handle rapid-fire posts sequentially
let processingQueue: TruthPost[] = [];
let isProcessing = false;
const MAX_QUEUE_SIZE = 10;

async function processPost(post: TruthPost) {
  const startMs = Date.now();
  logger.info(MODULE, `═══ Processing post ${post.id} ═══`);
  logger.info(MODULE, `Content: "${post.content.substring(0, 120)}..."`);

  // Store the post
  store.addPost(post);
  eventBus.emit("new-post", { post });

  // ─── Step 1: Claude Analysis ───────────────────────────────
  const analysisResult = await analyzePost(post);

  if (!analysisResult.success || !analysisResult.analysis) {
    logger.error(MODULE, `Analysis failed: ${analysisResult.error}`);
    store.addError({
      timestamp: new Date().toISOString(),
      module: MODULE,
      message: `Analysis failed for post ${post.id}: ${analysisResult.error}`,
    });
    eventBus.emit("analysis-error", { postId: post.id, error: analysisResult.error });
    return;
  }

  const analysis = analysisResult.analysis;
  store.addAnalysis(analysis);

  logger.signal(
    MODULE,
    `Impact: ${analysis.impact} | Direction: ${analysis.direction} | Confidence: ${analysis.confidence} | Instrument: ${analysis.primaryInstrument}`
  );
  logger.info(MODULE, `Reasoning: ${analysis.reasoning}`);

  eventBus.emit("analysis-complete", { post, analysis });

  // ─── Step 2: Check if trade is warranted ───────────────────
  const config = getConfig();

  if (analysis.recommendedTrade.action === "none") {
    logger.info(MODULE, "No trade recommended — done");
    return;
  }

  if (analysis.impact === "none" || analysis.impact === "low") {
    logger.info(MODULE, `Impact "${analysis.impact}" too low — skipping trade`);
    return;
  }

  if (analysis.confidence < config.confidenceThreshold) {
    logger.info(
      MODULE,
      `Confidence ${analysis.confidence} below threshold ${config.confidenceThreshold} — skipping trade`
    );
    return;
  }

  // ─── Step 3: Execute trade ─────────────────────────────────
  logger.trade(
    MODULE,
    `Executing: ${analysis.recommendedTrade.action} ${analysis.recommendedTrade.instrument} (${analysis.recommendedTrade.size})`
  );

  const tradeRecord = await executeTrade(analysis, post);
  store.addTrade(tradeRecord);

  const totalMs = Date.now() - startMs;
  logger.trade(
    MODULE,
    `Trade ${tradeRecord.status}: ${tradeRecord.contractSymbol || "N/A"} — Total pipeline: ${totalMs}ms`
  );

  eventBus.emit("trade-executed", { post, analysis, trade: tradeRecord });
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (processingQueue.length > 0) {
    const post = processingQueue.shift()!;
    try {
      await processPost(post);
    } catch (err) {
      logger.error(MODULE, `Pipeline error for post ${post.id}: ${err}`);
      store.addError({
        timestamp: new Date().toISOString(),
        module: MODULE,
        message: `Pipeline crashed: ${err}`,
      });
    }
  }

  isProcessing = false;
}

function onNewPost(post: unknown) {
  const truthPost = post as TruthPost;

  if (processingQueue.length >= MAX_QUEUE_SIZE) {
    logger.warn(MODULE, "Queue full — dropping oldest unprocessed post");
    processingQueue.shift();
  }

  processingQueue.push(truthPost);
  processQueue();
}

// ─── Pipeline Control ────────────────────────────────────────

let isStarted = false;

export function startPipeline() {
  if (isStarted) {
    logger.warn(MODULE, "Pipeline already running");
    return;
  }

  logger.info(MODULE, "═══════════════════════════════════════");
  logger.info(MODULE, "   SOCIALPROJECT PIPELINE STARTING");
  logger.info(MODULE, "═══════════════════════════════════════");

  const config = getConfig();
  logger.info(MODULE, `Paper mode: ${config.paperMode}`);
  logger.info(MODULE, `Auto-execute: ${config.autoExecute}`);
  logger.info(MODULE, `Confidence threshold: ${config.confidenceThreshold}`);
  logger.info(MODULE, `Min impact level: ${config.minImpactLevel}`);
  logger.info(MODULE, `Poll interval: ${config.pollIntervalMs}ms`);

  // Listen for new posts from the monitor
  eventBus.on("new-post", onNewPost);

  // Start the Truth Social monitor
  monitorService.start();
  isStarted = true;

  eventBus.emit("pipeline-started");
}

export function stopPipeline() {
  monitorService.stop();
  eventBus.off("new-post", onNewPost);
  isStarted = false;
  processingQueue = [];
  logger.info(MODULE, "Pipeline stopped");
  eventBus.emit("pipeline-stopped");
}

export function getPipelineStatus() {
  return {
    isRunning: isStarted,
    queueLength: processingQueue.length,
    isProcessing,
    monitor: monitorService.getStatus(),
  };
}

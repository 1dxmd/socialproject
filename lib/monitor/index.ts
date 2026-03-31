// ═══════════════════════════════════════════════════════════════
// MONITOR SERVICE
// Orchestrates Truth Social polling with fallback strategies
// API → Scraper → RSS, with dedup and event emission
// ═══════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import { eventBus } from "@/lib/event-bus";
import { getConfig } from "@/lib/config";
import { fetchLatestPosts } from "./truth-social-api";
import { scrapeLatestPosts } from "./truth-social-scraper";
import { fetchRssPosts } from "./truth-social-rss";
import type { TruthPost, MonitorStatus } from "./types";

const MODULE = "Monitor";

class MonitorService {
  private seenIds = new Set<string>();
  private lastSinceId: string | undefined;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private status: MonitorStatus = {
    isRunning: false,
    lastPollAt: null,
    lastPostAt: null,
    postsDetected: 0,
    errors: 0,
    currentStrategy: "none",
  };
  // Track consecutive API failures for fallback logic
  private apiFailures = 0;
  private readonly MAX_API_FAILURES = 3;

  getStatus(): MonitorStatus {
    return { ...this.status };
  }

  getSeenPosts(): string[] {
    return Array.from(this.seenIds);
  }

  start() {
    if (this.status.isRunning) {
      logger.warn(MODULE, "Already running");
      return;
    }

    const config = getConfig();
    logger.info(MODULE, `Starting poll loop — interval ${config.pollIntervalMs}ms`);

    this.status.isRunning = true;
    this.poll(); // Immediate first poll
    this.intervalHandle = setInterval(() => this.poll(), config.pollIntervalMs);
    eventBus.emit("monitor-started");
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.status.isRunning = false;
    logger.info(MODULE, "Stopped");
    eventBus.emit("monitor-stopped");
  }

  private async poll() {
    const config = getConfig();
    this.status.lastPollAt = new Date().toISOString();

    let posts: TruthPost[] = [];
    let strategy: MonitorStatus["currentStrategy"] = "api";

    // Strategy 1: Mastodon API (primary)
    if (this.apiFailures < this.MAX_API_FAILURES) {
      const result = await fetchLatestPosts(
        config.truthSocialAccountId,
        this.lastSinceId
      );

      if (!result.error && result.posts.length >= 0) {
        posts = result.posts;
        strategy = "api";
        this.apiFailures = 0;
      } else {
        this.apiFailures++;
        logger.warn(
          MODULE,
          `API failed (${this.apiFailures}/${this.MAX_API_FAILURES}): ${result.error}`
        );
      }
    }

    // Strategy 2: HTML scraper (fallback)
    if (posts.length === 0 && this.apiFailures >= this.MAX_API_FAILURES) {
      const result = await scrapeLatestPosts();
      if (!result.error && result.posts.length > 0) {
        posts = result.posts;
        strategy = "scraper";
      }
    }

    // Strategy 3: RSS (last resort)
    if (posts.length === 0 && this.apiFailures >= this.MAX_API_FAILURES) {
      const result = await fetchRssPosts();
      if (!result.error && result.posts.length > 0) {
        posts = result.posts;
        strategy = "rss";
      }
    }

    this.status.currentStrategy = strategy;

    // Filter out already-seen posts (dedup)
    const newPosts = posts.filter((p) => !this.seenIds.has(p.id));

    // Mark all fetched posts as seen
    for (const p of posts) {
      this.seenIds.add(p.id);
    }

    // Update sinceId for pagination (use highest ID from this batch)
    if (posts.length > 0) {
      // Mastodon IDs are snowflake-like; the latest post has the highest ID
      const maxId = posts.reduce((max, p) => (p.id > max ? p.id : max), posts[0].id);
      this.lastSinceId = maxId;
    }

    // Emit events for genuinely new posts
    if (newPosts.length > 0) {
      logger.info(MODULE, `${newPosts.length} NEW post(s) detected!`);
      this.status.postsDetected += newPosts.length;
      this.status.lastPostAt = newPosts[0].createdAt;

      // Emit each post individually (newest first for processing priority)
      for (const post of newPosts.reverse()) {
        eventBus.emit("new-post", post);
      }
    }
  }
}

// Singleton
const globalForMonitor = globalThis as unknown as { monitorService: MonitorService };
export const monitorService =
  globalForMonitor.monitorService || new MonitorService();
if (process.env.NODE_ENV !== "production")
  globalForMonitor.monitorService = monitorService;

export type { TruthPost, MonitorStatus };

// ═══════════════════════════════════════════════════════════════
// TRUTH SOCIAL SCRAPER
// Fallback strategy — scrapes the public profile page with Cheerio
// Used when the Mastodon API is blocked or rate-limited
// ═══════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";
import { logger } from "@/lib/logger";
import type { TruthPost } from "./types";

const MODULE = "TruthScraper";
const PROFILE_URL = "https://truthsocial.com/@realDonaldTrump";

export async function scrapeLatestPosts(): Promise<{
  posts: TruthPost[];
  error?: string;
}> {
  try {
    const response = await fetch(PROFILE_URL, {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return {
        posts: [],
        error: `Scraper HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const posts: TruthPost[] = [];

    // Truth Social uses Mastodon-like HTML structure
    // Look for status entries in the page
    $("div[data-id], article[data-id], .status").each((_, el) => {
      const $el = $(el);
      const id = $el.attr("data-id") || `scraped-${Date.now()}-${posts.length}`;
      const contentHtml = $el.find(".status__content, .e-content, p").html() || "";
      const content = $el.find(".status__content, .e-content, p").text().trim();
      const timeEl = $el.find("time");
      const createdAt = timeEl.attr("datetime") || new Date().toISOString();

      if (content) {
        posts.push({
          id,
          createdAt,
          content,
          contentHtml,
          url: `${PROFILE_URL}/${id}`,
          isRepost: false,
          mediaAttachments: [],
          detectedAt: new Date().toISOString(),
        });
      }
    });

    logger.info(MODULE, `Scraped ${posts.length} posts`);
    return { posts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(MODULE, `Scrape failed: ${message}`);
    return { posts: [], error: message };
  }
}

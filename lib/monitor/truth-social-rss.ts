// ═══════════════════════════════════════════════════════════════
// TRUTH SOCIAL RSS FEED
// Fallback strategy #2 — Mastodon instances expose RSS at /@user.rss
// ═══════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import type { TruthPost } from "./types";

const MODULE = "TruthRSS";
const RSS_URL = "https://truthsocial.com/@realDonaldTrump.rss";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function fetchRssPosts(): Promise<{
  posts: TruthPost[];
  error?: string;
}> {
  try {
    const response = await fetch(RSS_URL, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { posts: [], error: `RSS HTTP ${response.status}` };
    }

    const xml = await response.text();
    const posts: TruthPost[] = [];

    // Simple XML parsing without a library — RSS is predictable
    const items = xml.split("<item>").slice(1);
    for (const item of items) {
      const getTag = (tag: string): string => {
        const match = item.match(
          new RegExp(`<${tag}><!\\[CDATA\\[(.+?)\\]\\]></${tag}>|<${tag}>(.+?)</${tag}>`, "s")
        );
        return match ? (match[1] || match[2] || "").trim() : "";
      };

      const title = getTag("title");
      const link = getTag("link");
      const pubDate = getTag("pubDate");
      const description = getTag("description");
      const guid = getTag("guid");

      const contentHtml = description || title;
      const content = stripHtml(contentHtml);

      if (content) {
        posts.push({
          id: guid || link || `rss-${Date.now()}-${posts.length}`,
          createdAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          content,
          contentHtml,
          url: link || RSS_URL,
          isRepost: false,
          mediaAttachments: [],
          detectedAt: new Date().toISOString(),
        });
      }
    }

    logger.info(MODULE, `RSS fetched ${posts.length} posts`);
    return { posts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(MODULE, `RSS failed: ${message}`);
    return { posts: [], error: message };
  }
}

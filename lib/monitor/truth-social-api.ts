// ═══════════════════════════════════════════════════════════════
// TRUTH SOCIAL API CLIENT
// Primary monitoring strategy — Mastodon-compatible REST API
// Polls /api/v1/accounts/{id}/statuses for new posts
// ═══════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import type { TruthPost, MastodonStatus } from "./types";

const MODULE = "TruthSocialAPI";
const BASE_URL = "https://truthsocial.com";

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

function toTruthPost(status: MastodonStatus): TruthPost {
  const isRepost = status.reblog !== null;
  const source = isRepost ? status.reblog! : status;

  return {
    id: status.id,
    createdAt: source.created_at,
    content: stripHtml(source.content),
    contentHtml: source.content,
    url: source.url || `${BASE_URL}/@realDonaldTrump/${status.id}`,
    isRepost,
    repostAuthor: isRepost
      ? status.reblog!.account?.display_name || status.reblog!.account?.username
      : undefined,
    mediaAttachments: (source.media_attachments || []).map((m) => ({
      type: (m.type as TruthPost["mediaAttachments"][0]["type"]) || "unknown",
      url: m.url,
      previewUrl: m.preview_url,
      description: m.description || undefined,
    })),
    detectedAt: new Date().toISOString(),
  };
}

export async function fetchLatestPosts(
  accountId: string,
  sinceId?: string,
  limit: number = 10
): Promise<{ posts: TruthPost[]; error?: string }> {
  try {
    const params = new URLSearchParams({
      exclude_replies: "true",
      limit: String(limit),
    });
    if (sinceId) params.set("since_id", sinceId);

    const url = `${BASE_URL}/api/v1/accounts/${accountId}/statuses?${params}`;
    logger.debug(MODULE, `Polling: ${url}`);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SocialProject/1.0",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        posts: [],
        error: `HTTP ${response.status}: ${text.substring(0, 200)}`,
      };
    }

    const statuses: MastodonStatus[] = await response.json();
    const posts = statuses.map(toTruthPost);

    logger.debug(MODULE, `Fetched ${posts.length} posts`);
    return { posts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(MODULE, `Fetch failed: ${message}`);
    return { posts: [], error: message };
  }
}

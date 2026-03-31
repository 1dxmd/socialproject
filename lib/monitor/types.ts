// ═══════════════════════════════════════════════════════════════
// TRUTH SOCIAL POST TYPES
// ═══════════════════════════════════════════════════════════════

export interface TruthPost {
  id: string;
  createdAt: string; // ISO timestamp
  content: string; // Plain text (HTML stripped)
  contentHtml: string; // Original HTML
  url: string;
  isRepost: boolean;
  repostAuthor?: string;
  mediaAttachments: MediaAttachment[];
  detectedAt: string; // When we first saw it (ISO)
}

export interface MediaAttachment {
  type: "image" | "video" | "gifv" | "audio" | "unknown";
  url: string;
  previewUrl?: string;
  description?: string;
}

export interface MonitorStatus {
  isRunning: boolean;
  lastPollAt: string | null;
  lastPostAt: string | null;
  postsDetected: number;
  errors: number;
  currentStrategy: "api" | "scraper" | "rss" | "none";
}

// Raw Mastodon API response shape
export interface MastodonStatus {
  id: string;
  created_at: string;
  content: string; // HTML
  url: string;
  reblog: MastodonStatus | null;
  media_attachments: Array<{
    type: string;
    url: string;
    preview_url: string;
    description: string | null;
  }>;
  account: {
    id: string;
    username: string;
    display_name: string;
  };
}

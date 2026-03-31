// ═══════════════════════════════════════════════════════════════
// MANUAL ANALYSIS API
// Test the Claude analyzer with a custom post text
// Useful for testing prompts without waiting for real posts
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { analyzePost } from "@/lib/analyzer";
import type { TruthPost } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = body.text;

  if (!text || typeof text !== "string") {
    return NextResponse.json(
      { error: "Provide a 'text' field with the post content" },
      { status: 400 }
    );
  }

  // Create a synthetic TruthPost for analysis
  const syntheticPost: TruthPost = {
    id: `test-${Date.now()}`,
    createdAt: new Date().toISOString(),
    content: text,
    contentHtml: text,
    url: "https://truthsocial.com/test",
    isRepost: body.isRepost || false,
    mediaAttachments: [],
    detectedAt: new Date().toISOString(),
  };

  const result = await analyzePost(syntheticPost);

  return NextResponse.json(result);
}

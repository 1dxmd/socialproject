// ═══════════════════════════════════════════════════════════════
// STATUS API
// Returns current system state for the dashboard
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { getPipelineStatus } from "@/lib/pipeline";
import { getRiskStatus } from "@/lib/trader/risk-manager";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    pipeline: getPipelineStatus(),
    risk: getRiskStatus(),
    counts: {
      posts: store.getPosts(1000).length,
      analyses: store.getAnalyses(1000).length,
      trades: store.getTrades(1000).length,
      errors: store.getErrors(100).length,
    },
    recentPosts: store.getPosts(5),
    recentAnalyses: store.getAnalyses(5),
    recentTrades: store.getTrades(5),
    recentErrors: store.getErrors(5),
    timestamp: new Date().toISOString(),
  });
}

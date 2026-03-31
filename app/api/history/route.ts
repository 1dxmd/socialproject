// ═══════════════════════════════════════════════════════════════
// HISTORY API
// Full trade history, P&L tracking, and post/analysis logs
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  if (type === "posts") {
    return NextResponse.json({ posts: store.getPosts(limit) });
  }

  if (type === "analyses") {
    return NextResponse.json({ analyses: store.getAnalyses(limit) });
  }

  if (type === "trades") {
    return NextResponse.json({ trades: store.getTrades(limit) });
  }

  if (type === "pnl") {
    return NextResponse.json({ pnl: store.getPnlHistory() });
  }

  if (type === "errors") {
    return NextResponse.json({ errors: store.getErrors(limit) });
  }

  // Return everything
  return NextResponse.json({
    posts: store.getPosts(limit),
    analyses: store.getAnalyses(limit),
    trades: store.getTrades(limit),
    pnl: store.getPnlHistory(),
    errors: store.getErrors(20),
  });
}

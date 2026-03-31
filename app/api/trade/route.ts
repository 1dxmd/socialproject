// ═══════════════════════════════════════════════════════════════
// TRADING CONTROL API
// Manual trade execution, kill switch, and position management
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { haltTrading, resumeTrading, getRiskStatus } from "@/lib/trader/risk-manager";
import { getPositions, getAccount } from "@/lib/trader/alpaca-client";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [positions, account, risk] = await Promise.all([
    getPositions(),
    getAccount(),
    Promise.resolve(getRiskStatus()),
  ]);

  return NextResponse.json({
    positions: positions.data || [],
    account: account.data || null,
    risk,
    recentTrades: store.getTrades(20),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === "halt") {
    haltTrading(body.reason || "Manual halt via dashboard");
    store.setTradingHalted(true);
    return NextResponse.json({ status: "halted", risk: getRiskStatus() });
  }

  if (action === "resume") {
    resumeTrading();
    store.setTradingHalted(false);
    return NextResponse.json({ status: "resumed", risk: getRiskStatus() });
  }

  return NextResponse.json(
    { error: "Invalid action. Use 'halt' or 'resume'" },
    { status: 400 }
  );
}

// ═══════════════════════════════════════════════════════════════
// MONITOR CONTROL API
// Start/stop the Truth Social monitor, trigger manual polls
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { startPipeline, stopPipeline, getPipelineStatus } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPipelineStatus());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === "start") {
    startPipeline();
    return NextResponse.json({ status: "started", ...getPipelineStatus() });
  }

  if (action === "stop") {
    stopPipeline();
    return NextResponse.json({ status: "stopped", ...getPipelineStatus() });
  }

  return NextResponse.json(
    { error: "Invalid action. Use 'start' or 'stop'" },
    { status: 400 }
  );
}

// ═══════════════════════════════════════════════════════════════
// TRUTH SOCIAL PROXY
// Proxies requests to Truth Social API using cf_clearance cookie
// from the user's browser. This bypasses Cloudflare bot protection.
//
// Flow: Browser poller on our page → this proxy → Truth Social API
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MODULE = "TSProxy";
const ACCOUNT_ID = "107780257626128497";
const TS_BASE = "https://truthsocial.com";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sinceId = searchParams.get("since_id");
  const limit = searchParams.get("limit") || "5";
  const cfClearance = searchParams.get("cf_clearance") || "";
  const userAgent = request.headers.get("user-agent") || "";

  const params = new URLSearchParams({
    exclude_replies: "true",
    limit,
  });
  if (sinceId) params.set("since_id", sinceId);

  const url = `${TS_BASE}/api/v1/accounts/${ACCOUNT_ID}/statuses?${params}`;
  logger.debug(MODULE, `Proxying: ${url}`);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": userAgent || "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };

    // Pass cf_clearance cookie if provided
    if (cfClearance) {
      headers["Cookie"] = `cf_clearance=${cfClearance}`;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.warn(MODULE, `Truth Social returned ${response.status}`);
      return NextResponse.json(
        { error: `Truth Social API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(MODULE, `Proxy error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

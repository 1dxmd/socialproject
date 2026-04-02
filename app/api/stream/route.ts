// ═══════════════════════════════════════════════════════════════
// SERVER-SENT EVENTS (SSE) ENDPOINT
// Streams real-time updates to the dashboard
// Events: new-post, analysis-complete, trade-executed, status-update
// ═══════════════════════════════════════════════════════════════

import { eventBus } from "@/lib/event-bus";
import { getPipelineStatus } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Pipeline is now driven by browser-based poller → /api/ingest
  // No auto-start of server-side monitor (Cloudflare blocks it)

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial status
      const initialData = JSON.stringify({
        event: "connected",
        data: getPipelineStatus(),
      });
      controller.enqueue(encoder.encode(`data: ${initialData}\n\n`));

      // Subscribe to all events via wildcard
      const handler = (payload: unknown) => {
        try {
          const data = JSON.stringify(payload);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Client disconnected
        }
      };

      const unsubscribe = eventBus.on("*", handler);

      // Send heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          const hb = JSON.stringify({
            event: "heartbeat",
            data: {
              timestamp: new Date().toISOString(),
              ...getPipelineStatus(),
            },
          });
          controller.enqueue(encoder.encode(`data: ${hb}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on close
      const cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
      };

      // Store cleanup for when the connection drops
      (controller as unknown as { _cleanup?: () => void })._cleanup = cleanup;
    },
    cancel(controller) {
      const cleanup = (controller as unknown as { _cleanup?: () => void })
        ._cleanup;
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

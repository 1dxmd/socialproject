// ═══════════════════════════════════════════════════════════════
// CUSTOM SERVER
// Runs Next.js + WebSocket server on separate ports
// Next.js on PORT (default 3001), WebSocket on WS_PORT (default 3002)
// ═══════════════════════════════════════════════════════════════

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3001", 10);
const wsPort = parseInt(process.env.WS_PORT || "3002", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Inline post processing (avoids module resolution issues with custom server)
const seenPostIds = new Set<string>();

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

app.prepare().then(() => {
  // ─── HTTP Server (Next.js) ──────────────────────────────
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  httpServer.listen(port, () => {
    console.log(`\n  ▲ SocialProject`);
    console.log(`  - Next.js:    http://${hostname}:${port}`);
    console.log(`  - Dashboard:  http://${hostname}:${port}`);
    console.log(`  - Poller:     http://${hostname}:${port}/poller`);
    console.log(`  - Setup:      http://${hostname}:${port}/setup`);
    console.log(`  - WebSocket:  ws://${hostname}:${wsPort}`);
    console.log(`  - Mode:       ${dev ? "development" : "production"}\n`);
  });

  // ─── WebSocket Server ──────────────────────────────────
  const wss = new WebSocketServer({ port: wsPort });

  wss.on("listening", () => {
    console.log(`  WS server ready on port ${wsPort}`);
  });

  wss.on("connection", (ws) => {
    console.log("[WS] Browser poller connected");
    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "posts" && Array.isArray(msg.posts)) {
          const newPosts = msg.posts.filter(
            (p: { id: string }) => !seenPostIds.has(p.id)
          );
          newPosts.forEach((p: { id: string }) => seenPostIds.add(p.id));

          if (newPosts.length === 0) {
            ws.send(JSON.stringify({ type: "ack", newPosts: 0 }));
            return;
          }

          console.log(`[WS] ${newPosts.length} new post(s), forwarding to ingest...`);

          // Forward to our own ingest API
          try {
            const ingestRes = await fetch(
              `http://${hostname}:${port}/api/ingest`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ posts: newPosts }),
              }
            );
            const result = await ingestRes.json();

            ws.send(
              JSON.stringify({
                type: "ingest-result",
                results: result.results || [],
              })
            );
          } catch (err) {
            console.error("[WS] Ingest forward failed:", err);
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Ingest forward failed",
              })
            );
          }
        }

        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (err) {
        console.error("[WS] Parse error:", err);
      }
    });

    ws.on("close", () => {
      console.log("[WS] Browser poller disconnected");
    });
  });

  // Keep seenPostIds bounded
  setInterval(() => {
    if (seenPostIds.size > 5000) {
      const arr = Array.from(seenPostIds);
      arr.splice(0, 2000);
      seenPostIds.clear();
      arr.forEach((id) => seenPostIds.add(id));
    }
  }, 60000);
});

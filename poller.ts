#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// TRUTH SOCIAL POLLER
// Standalone script that uses your Chrome browser to poll
// Trump's Truth Social posts and send them to the local server.
//
// HOW IT WORKS:
// 1. Connects to your running Chrome browser via DevTools protocol
// 2. Opens a tab to truthsocial.com (bypasses Cloudflare as real browser)
// 3. Polls the Mastodon API from within the page context
// 4. Sends new posts to localhost:3001/api/ingest via HTTP
//
// USAGE:
//   Start Chrome with remote debugging:
//     /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
//   Then run:
//     npx tsx poller.ts
//
// Or simply use the simpler approach below (no Chrome needed):
//   npx tsx poller.ts --standalone
// ═══════════════════════════════════════════════════════════════

const SERVER = process.env.SERVER_URL || "http://localhost:3001";
const ACCOUNT_ID = "107780257626128497";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "3000", 10);
const CHROME_DEBUG_PORT = parseInt(process.env.CHROME_PORT || "9222", 10);

let lastSeenId: string | null = null;
let postCount = 0;
let errorCount = 0;

function log(level: string, msg: string) {
  const ts = new Date().toISOString().replace("T", " ").substring(0, 19);
  const colors: Record<string, string> = {
    INFO: "\x1b[36m",
    SIGNAL: "\x1b[35m",
    TRADE: "\x1b[32m",
    ERROR: "\x1b[31m",
    WARN: "\x1b[33m",
  };
  console.log(`${ts} ${colors[level] || ""}[${level}]\x1b[0m ${msg}`);
}

// ─── Approach 1: Connect to running Chrome ──────────────────

async function pollViaChromeDebug(): Promise<boolean> {
  try {
    // Check if Chrome is available with remote debugging
    const versionRes = await fetch(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json/version`);
    if (!versionRes.ok) return false;

    const version = await versionRes.json();
    log("INFO", `Connected to Chrome ${version.Browser}`);

    // Get or create a tab on truthsocial.com
    const tabsRes = await fetch(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json`);
    const tabs = await tabsRes.json();
    let tsTab = tabs.find((t: { url: string }) => t.url.includes("truthsocial.com"));

    if (!tsTab) {
      // Create a new tab
      const newTabRes = await fetch(
        `http://127.0.0.1:${CHROME_DEBUG_PORT}/json/new?${encodeURIComponent("https://truthsocial.com/@realDonaldTrump")}`
      );
      tsTab = await newTabRes.json();
      log("INFO", "Opened new Truth Social tab");
      // Wait for page to load
      await new Promise((r) => setTimeout(r, 5000));
    }

    // Use CDP to execute JavaScript in the tab
    const wsUrl = tsTab.webSocketDebuggerUrl;
    if (!wsUrl) {
      log("WARN", "No WebSocket debugger URL available");
      return false;
    }

    const { default: WebSocket } = await import("ws");
    const ws = new WebSocket(wsUrl);

    return new Promise((resolve) => {
      ws.on("open", () => {
        const script = `
          (async () => {
            const url = '/api/v1/accounts/${ACCOUNT_ID}/statuses?exclude_replies=true&limit=5'
              + (${lastSeenId ? `'&since_id=${lastSeenId}'` : "''"});
            const res = await fetch(url);
            if (!res.ok) return JSON.stringify({ error: res.status });
            const posts = await res.json();
            return JSON.stringify({ posts: posts });
          })()
        `;

        const msgId = Date.now();
        ws.send(
          JSON.stringify({
            id: msgId,
            method: "Runtime.evaluate",
            params: { expression: script, awaitPromise: true, returnByValue: true },
          })
        );

        ws.on("message", async (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id !== msgId) return;

            ws.close();

            const result = JSON.parse(msg.result?.result?.value || "{}");
            if (result.error) {
              log("ERROR", `API returned ${result.error}`);
              resolve(true); // Connected, just API error
              return;
            }

            const posts = result.posts || [];
            if (posts.length === 0) {
              resolve(true);
              return;
            }

            const maxId = posts.reduce(
              (max: string, p: { id: string }) => (p.id > max ? p.id : max),
              posts[0].id
            );

            if (!lastSeenId) {
              lastSeenId = maxId;
              log("INFO", `Initialized — tracking from post ${maxId}`);
              resolve(true);
              return;
            }

            lastSeenId = maxId;
            postCount += posts.length;
            log("SIGNAL", `${posts.length} NEW POST(S)! Total sent: ${postCount}`);

            // Send to our server
            await sendToServer(posts);
            resolve(true);
          } catch (e) {
            log("ERROR", `CDP message parse error: ${e}`);
            ws.close();
            resolve(true);
          }
        });

        setTimeout(() => {
          ws.close();
          resolve(false);
        }, 10000);
      });

      ws.on("error", () => resolve(false));
    });
  } catch {
    return false;
  }
}

// ─── Approach 2: Standalone (no Chrome needed) ──────────────
// Uses puppeteer-core with system Chrome

async function startStandalonePoller() {
  log("INFO", "Starting standalone poller with Puppeteer...");

  const puppeteer = await import("puppeteer-core");

  // Find Chrome
  const chromePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];

  let chromePath = "";
  for (const p of chromePaths) {
    try {
      const { existsSync } = await import("fs");
      if (existsSync(p)) {
        chromePath = p;
        break;
      }
    } catch { /* skip */ }
  }

  if (!chromePath) {
    log("ERROR", "Chrome not found! Install Chrome or set CHROME_PATH env var.");
    process.exit(1);
  }

  log("INFO", `Using Chrome at: ${chromePath}`);

  const browser = await puppeteer.default.launch({
    executablePath: process.env.CHROME_PATH || chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );

  log("INFO", "Navigating to Truth Social...");
  await page.goto("https://truthsocial.com/@realDonaldTrump", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  log("INFO", "Page loaded. Starting poll loop...");

  // Poll loop
  setInterval(async () => {
    try {
      const result = await page.evaluate(
        async (accountId: string, sinceId: string | null) => {
          const url =
            `/api/v1/accounts/${accountId}/statuses?exclude_replies=true&limit=5` +
            (sinceId ? `&since_id=${sinceId}` : "");
          const res = await fetch(url);
          if (!res.ok) return { error: res.status };
          const posts = await res.json();
          return { posts };
        },
        ACCOUNT_ID,
        lastSeenId
      );

      if (result.error) {
        errorCount++;
        if (errorCount % 10 === 1) log("ERROR", `API returned ${result.error}`);
        return;
      }

      errorCount = 0;
      const posts = result.posts || [];
      if (posts.length === 0) return;

      const maxId = posts.reduce(
        (max: string, p: { id: string }) => (p.id > max ? p.id : max),
        posts[0].id
      );

      if (!lastSeenId) {
        lastSeenId = maxId;
        log("INFO", `Initialized — tracking from post ${maxId}`);
        return;
      }

      lastSeenId = maxId;
      postCount += posts.length;
      log("SIGNAL", `${posts.length} NEW POST(S)! Total sent: ${postCount}`);

      await sendToServer(posts);
    } catch (e) {
      errorCount++;
      if (errorCount % 10 === 1) log("ERROR", `Poll error: ${e}`);
    }
  }, POLL_INTERVAL);

  // Keep alive
  process.on("SIGINT", async () => {
    log("INFO", "Shutting down...");
    await browser.close();
    process.exit(0);
  });
}

// ─── Send posts to our server ────────────────────────────────

async function sendToServer(posts: unknown[]) {
  try {
    const res = await fetch(`${SERVER}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts }),
    });

    if (!res.ok) {
      log("ERROR", `Server returned ${res.status}`);
      return;
    }

    const data = await res.json();
    const results = data.results || [];

    for (const r of results) {
      if (r.analysis) {
        const a = r.analysis;
        const icon = a.impact === "critical" || a.impact === "high" ? "🔴" : a.impact === "medium" ? "🟡" : "🟢";
        log(
          "SIGNAL",
          `${icon} ${a.impact.toUpperCase()} ${a.direction} $${a.instrument} (${Math.round(a.confidence * 100)}% conf) — ${a.reasoning}`
        );
        if (a.action !== "none") {
          log("TRADE", `→ ${a.action.replace("_", " ").toUpperCase()} ${a.instrument}`);
        }
      }
    }
  } catch (e) {
    log("ERROR", `Failed to send to server: ${e}`);
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log("\n  ╔════════════════════════════════════════╗");
  console.log("  ║   SOCIALPROJECT — Truth Social Poller   ║");
  console.log("  ╚════════════════════════════════════════╝\n");
  log("INFO", `Server: ${SERVER}`);
  log("INFO", `Poll interval: ${POLL_INTERVAL}ms`);

  const useStandalone = process.argv.includes("--standalone");

  if (!useStandalone) {
    // Try connecting to running Chrome first
    log("INFO", "Trying Chrome DevTools on port " + CHROME_DEBUG_PORT + "...");
    const chromeOk = await pollViaChromeDebug();

    if (chromeOk) {
      log("INFO", "Chrome DevTools connected! Starting poll loop...");
      setInterval(async () => {
        await pollViaChromeDebug();
      }, POLL_INTERVAL);
      return;
    }

    log("WARN", "Chrome DevTools not available, falling back to standalone mode...");
  }

  await startStandalonePoller();
}

main().catch((e) => {
  log("ERROR", `Fatal: ${e}`);
  process.exit(1);
});

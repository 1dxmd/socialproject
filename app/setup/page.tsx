"use client";

import { useState } from "react";

// Bookmarklet using sendBeacon (Chrome allows this from HTTPS→HTTP localhost)
const POLLER_SCRIPT = `
(function() {
  if (window.__SP_RUNNING) { alert('SP Poller already running!'); return; }
  window.__SP_RUNNING = true;

  var SERVER = 'http://localhost:SERVER_PORT_PLACEHOLDER';
  var AID = '107780257626128497';
  var INTERVAL = 3000;
  var lastId = null;
  var sent = 0;

  var b = document.createElement('div');
  b.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;background:#0a0a0a;color:#00ff88;font-family:monospace;font-size:11px;padding:8px 14px;border-radius:8px;border:1px solid #00ff88;box-shadow:0 0 20px rgba(0,255,136,0.3);cursor:pointer;user-select:none;min-width:140px;';
  b.innerHTML = 'SP: STARTING...';
  b.title = 'Click to stop poller';
  b.onclick = function() {
    window.__SP_RUNNING = false;
    clearInterval(iv);
    b.innerHTML = 'SP: STOPPED';
    b.style.color = '#ff4444';
    b.style.borderColor = '#ff4444';
    setTimeout(function() { b.remove(); }, 2000);
  };
  document.body.appendChild(b);

  function upd(t, c) {
    b.style.color = c;
    b.style.borderColor = c;
    b.innerHTML = t;
  }

  async function poll() {
    if (!window.__SP_RUNNING) return;
    try {
      var url = '/api/v1/accounts/' + AID + '/statuses?exclude_replies=true&limit=5';
      if (lastId) url += '&since_id=' + lastId;
      var r = await fetch(url);
      if (!r.ok) { upd('SP: API ' + r.status, '#ff4444'); return; }
      var posts = await r.json();
      if (!posts || !posts.length) { if (lastId) upd('SP: WATCHING | ' + sent + ' sent', '#00ff88'); return; }
      var mx = posts.reduce(function(m, p) { return p.id > m ? p.id : m; }, posts[0].id);
      if (!lastId) { lastId = mx; upd('SP: READY | watching', '#00ff88'); return; }
      lastId = mx;
      sent += posts.length;
      upd('SP: SENDING ' + posts.length + '... | ' + sent + ' total', '#ffaa00');
      var blob = new Blob([JSON.stringify({posts: posts})], {type: 'text/plain'});
      navigator.sendBeacon(SERVER + '/api/ingest', blob);
      upd('SP: SENT ' + posts.length + ' | ' + sent + ' total', '#00ff88');
    } catch(e) {
      upd('SP: ERROR', '#ff4444');
    }
  }

  var iv = setInterval(poll, INTERVAL);
  poll();
  upd('SP: STARTING...', '#ffaa00');
})();
`;

export default function SetupPage() {
  const [port, setPort] = useState("3001");
  const [copied, setCopied] = useState(false);

  const bookmarkletCode = `javascript:${encodeURIComponent(POLLER_SCRIPT.replace(/SERVER_PORT_PLACEHOLDER/g, port).replace(/\n/g, " ").replace(/\s+/g, " ").trim())}`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-sp-black text-sp-text p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-sp-green">SOCIAL</span>PROJECT Setup
            </h1>
            <p className="text-sp-muted text-sm mt-1">
              Connect the browser poller to start monitoring Trump&apos;s posts
            </p>
          </div>
          <a href="/" className="text-xs text-sp-blue hover:underline">Dashboard</a>
        </div>

        {/* Step 1 */}
        <div className="bg-sp-panel border border-sp-border rounded-lg p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-sp-blue text-sp-black text-xs font-bold px-2 py-0.5 rounded">1</span>
            <h2 className="font-bold">Create .env.local</h2>
          </div>
          <pre className="bg-sp-dark rounded p-4 text-xs text-sp-muted overflow-x-auto">
{`# Required — Claude API for post analysis
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional — Alpaca for auto-trading (paper mode)
# ALPACA_API_KEY=PK...
# ALPACA_API_SECRET=...
# ALPACA_BASE_URL=https://paper-api.alpaca.markets
# AUTO_EXECUTE=false`}
          </pre>
        </div>

        {/* Step 2 */}
        <div className="bg-sp-panel border border-sp-border rounded-lg p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-sp-blue text-sp-black text-xs font-bold px-2 py-0.5 rounded">2</span>
            <h2 className="font-bold">Start the Server</h2>
          </div>
          <pre className="bg-sp-dark rounded p-4 text-xs text-sp-green overflow-x-auto">
{`cd /Users/markashkan/socialproject
npm run dev`}
          </pre>
          <p className="text-xs text-sp-muted mt-2">
            Dashboard at <span className="text-sp-cyan">http://localhost:{port}</span>
          </p>
        </div>

        {/* Step 3 */}
        <div className="bg-sp-panel border border-sp-border rounded-lg p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-sp-blue text-sp-black text-xs font-bold px-2 py-0.5 rounded">3</span>
            <h2 className="font-bold">Install the Bookmarklet</h2>
          </div>

          <div className="mb-3">
            <label className="text-xs text-sp-muted block mb-1">Server Port:</label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="bg-sp-dark border border-sp-border rounded px-3 py-1.5 text-sm font-mono w-24 focus:outline-none focus:border-sp-blue"
            />
          </div>

          <p className="text-sm text-sp-muted mb-4">
            Drag the green button to your Chrome bookmarks bar:
          </p>

          <div className="flex items-center gap-4 mb-4">
            <a
              href={bookmarkletCode}
              className="inline-block px-5 py-2.5 bg-sp-green text-sp-black font-bold text-sm rounded-lg hover:bg-sp-green/80 no-underline shadow-lg shadow-sp-green/20"
              onClick={(e) => e.preventDefault()}
              draggable
            >
              SP Poller
            </a>
            <span className="text-xs text-sp-muted">&larr; Drag to bookmarks bar</span>
          </div>

          <button
            onClick={copyBookmarklet}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${
              copied
                ? "bg-green-900/50 text-green-400 border border-green-700/50"
                : "bg-sp-dark border border-sp-border text-sp-muted hover:text-sp-text hover:border-sp-blue/50"
            }`}
          >
            {copied ? "Copied!" : "Copy Bookmarklet Code"}
          </button>
        </div>

        {/* Step 4 */}
        <div className="bg-sp-panel border border-sp-border rounded-lg p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-sp-blue text-sp-black text-xs font-bold px-2 py-0.5 rounded">4</span>
            <h2 className="font-bold">Activate</h2>
          </div>
          <ol className="text-sm text-sp-muted space-y-3 list-decimal list-inside">
            <li>
              Open{" "}
              <a href="https://truthsocial.com/@realDonaldTrump" target="_blank" rel="noopener noreferrer" className="text-sp-blue hover:underline">
                truthsocial.com/@realDonaldTrump
              </a>{" "}
              in Chrome
            </li>
            <li>Click the <span className="text-sp-green font-bold">&quot;SP Poller&quot;</span> bookmark</li>
            <li>Green badge appears: <span className="text-sp-green">SP: READY | watching</span></li>
            <li>Keep that tab open — polls every 3 seconds</li>
            <li>
              Watch the <a href="/" className="text-sp-blue hover:underline">Dashboard</a> for live analysis
            </li>
            <li>Click the badge to stop</li>
          </ol>
        </div>

        {/* Architecture */}
        <div className="bg-sp-panel border border-sp-border rounded-lg p-6">
          <h2 className="font-bold mb-3">How It Works</h2>
          <div className="text-xs font-mono text-sp-muted space-y-1 leading-relaxed">
            <div className="text-sp-yellow">Chrome tab @ truthsocial.com</div>
            <div className="pl-4">Bookmarklet polls Truth Social API every 3s</div>
            <div className="pl-4">(same-origin request bypasses Cloudflare)</div>
            <div className="pl-8 text-sp-muted">│</div>
            <div className="pl-8 text-sp-blue">▼ sendBeacon → POST /api/ingest</div>
            <div className="text-sp-green">Local Server (localhost:{port})</div>
            <div className="pl-4">→ Claude Sonnet analysis (&lt;1s)</div>
            <div className="pl-4">→ 12-layer risk check</div>
            <div className="pl-4">→ Alpaca options execution (if enabled)</div>
            <div className="pl-8 text-sp-muted">│</div>
            <div className="pl-8 text-sp-cyan">▼ SSE</div>
            <div className="text-sp-cyan">Dashboard (localhost:{port})</div>
            <div className="mt-3 text-sp-green font-bold">Target: &lt;3s post → analysis → trade signal</div>
          </div>
        </div>
      </div>
    </div>
  );
}

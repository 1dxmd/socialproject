"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface TruthPost {
  id: string;
  created_at: string;
  content: string;
  url: string;
  reblog: unknown | null;
  media_attachments: unknown[];
}

interface IngestResult {
  id: string;
  status: string;
  analysis?: {
    impact: string;
    direction: string;
    confidence: number;
    instrument: string;
    action: string;
    reasoning: string;
    latencyMs: number;
  };
}

export default function PollerPage() {
  const [status, setStatus] = useState<"idle" | "starting" | "polling" | "error">("idle");
  const [lastPoll, setLastPoll] = useState<string>("");
  const [postsSent, setPostsSent] = useState(0);
  const [signals, setSignals] = useState<IngestResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const lastSeenId = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstPoll = useRef(true);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const poll = useCallback(async () => {
    try {
      // Build proxy URL
      const params = new URLSearchParams({ limit: "5" });
      if (lastSeenId.current) params.set("since_id", lastSeenId.current);

      const proxyUrl = `/api/proxy/truth-social?${params}`;
      const res = await fetch(proxyUrl);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        addLog(`Proxy returned ${res.status}: ${errText.substring(0, 100)}`);
        setStatus("error");
        return;
      }

      const posts: TruthPost[] = await res.json();

      // If error response from proxy
      if (!Array.isArray(posts)) {
        addLog(`Unexpected response: ${JSON.stringify(posts).substring(0, 100)}`);
        setStatus("error");
        return;
      }

      setStatus("polling");
      setLastPoll(new Date().toLocaleTimeString());

      if (posts.length === 0) return;

      // Update lastSeenId
      const maxId = posts.reduce((max, p) => (p.id > max ? p.id : max), posts[0].id);

      // On first successful poll, just record the ID
      if (isFirstPoll.current) {
        lastSeenId.current = maxId;
        isFirstPoll.current = false;
        addLog(`Initialized — tracking from post ${maxId}`);
        return;
      }

      lastSeenId.current = maxId;

      // We have new posts! Send to ingest
      addLog(`${posts.length} NEW POST(S) detected!`);

      const ingestRes = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts }),
      });

      if (ingestRes.ok) {
        const data = await ingestRes.json();
        setPostsSent((prev) => prev + posts.length);

        const results: IngestResult[] = data.results || [];
        for (const r of results) {
          if (r.analysis) {
            setSignals((prev) => [r, ...prev].slice(0, 50));
            addLog(
              `SIGNAL: ${r.analysis.impact.toUpperCase()} ${r.analysis.direction} ${r.analysis.instrument} (${Math.round(r.analysis.confidence * 100)}% conf, ${r.analysis.latencyMs}ms)`
            );
          } else {
            addLog(`Post ${r.id}: ${r.status}`);
          }
        }
      } else {
        addLog(`Ingest failed: ${ingestRes.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Error: ${msg}`);
      setErrors((prev) => [msg, ...prev].slice(0, 20));
    }
  }, [addLog]);

  const startPolling = () => {
    if (intervalRef.current) return;
    setStatus("starting");
    isFirstPoll.current = true;
    lastSeenId.current = null;
    addLog("Starting poller...");

    // First poll immediately
    poll().then(() => {
      addLog("Poller active — checking every 3 seconds");
      intervalRef.current = setInterval(poll, 3000);
    });
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus("idle");
    addLog("Poller stopped");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const impactColor = (impact: string) => {
    switch (impact) {
      case "critical": return "text-red-400";
      case "high": return "text-orange-400";
      case "medium": return "text-yellow-400";
      case "low": return "text-green-400";
      default: return "text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-sp-black text-sp-text p-6 font-mono">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">
              <span className="text-sp-green">SP</span> POLLER
            </h1>
            <p className="text-xs text-sp-muted mt-1">
              Truth Social Monitor + Claude Analysis Pipeline
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-sp-blue hover:underline">
              Dashboard
            </a>

            {status === "idle" || status === "error" ? (
              <button
                onClick={startPolling}
                className="px-4 py-2 bg-sp-green text-sp-black font-bold text-sm rounded hover:bg-sp-green/80"
              >
                START POLLER
              </button>
            ) : (
              <button
                onClick={stopPolling}
                className="px-4 py-2 bg-red-600 text-white font-bold text-sm rounded hover:bg-red-700"
              >
                STOP
              </button>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-sp-panel border border-sp-border rounded p-3">
            <div className="text-[10px] text-sp-muted uppercase">Status</div>
            <div className={`text-sm font-bold ${
              status === "polling" ? "text-sp-green" :
              status === "error" ? "text-red-400" :
              status === "starting" ? "text-yellow-400" :
              "text-sp-muted"
            }`}>
              {status === "polling" && (
                <span className="inline-block w-2 h-2 rounded-full bg-sp-green live-pulse mr-1" />
              )}
              {status.toUpperCase()}
            </div>
          </div>
          <div className="bg-sp-panel border border-sp-border rounded p-3">
            <div className="text-[10px] text-sp-muted uppercase">Last Poll</div>
            <div className="text-sm font-bold">{lastPoll || "—"}</div>
          </div>
          <div className="bg-sp-panel border border-sp-border rounded p-3">
            <div className="text-[10px] text-sp-muted uppercase">Posts Sent</div>
            <div className="text-sm font-bold text-sp-blue">{postsSent}</div>
          </div>
          <div className="bg-sp-panel border border-sp-border rounded p-3">
            <div className="text-[10px] text-sp-muted uppercase">Signals</div>
            <div className="text-sm font-bold text-sp-yellow">{signals.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Signals */}
          <div className="bg-sp-panel border border-sp-border rounded-lg p-4">
            <h2 className="text-xs font-bold text-sp-muted uppercase tracking-wider mb-3">
              Trade Signals
            </h2>
            {signals.length === 0 ? (
              <div className="text-sp-muted text-xs text-center py-6">
                Waiting for market-moving posts...
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {signals.map((s, i) => (
                  <div key={i} className="bg-sp-dark rounded p-2 text-xs animate-fade-in">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold uppercase ${impactColor(s.analysis!.impact)}`}>
                        {s.analysis!.impact}
                      </span>
                      <span className={s.analysis!.direction === "bullish" ? "text-green-400" : s.analysis!.direction === "bearish" ? "text-red-400" : "text-yellow-400"}>
                        {s.analysis!.direction === "bullish" ? "\u25B2" : s.analysis!.direction === "bearish" ? "\u25BC" : "\u25C6"} {s.analysis!.direction}
                      </span>
                      <span className="text-sp-cyan">${s.analysis!.instrument}</span>
                      <span className="text-sp-muted">{Math.round(s.analysis!.confidence * 100)}%</span>
                      <span className="text-sp-muted">{s.analysis!.latencyMs}ms</span>
                    </div>
                    {s.analysis!.action !== "none" && (
                      <div className={`font-bold ${s.analysis!.action === "buy_calls" ? "text-green-400" : "text-red-400"}`}>
                        {s.analysis!.action.replace("_", " ").toUpperCase()} {s.analysis!.instrument}
                      </div>
                    )}
                    <div className="text-sp-muted mt-1">{s.analysis!.reasoning}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Log */}
          <div className="bg-sp-panel border border-sp-border rounded-lg p-4">
            <h2 className="text-xs font-bold text-sp-muted uppercase tracking-wider mb-3">
              Live Log
            </h2>
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-sp-muted text-xs text-center py-6">
                  Click START POLLER to begin monitoring
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`text-[10px] font-mono ${
                      log.includes("SIGNAL") ? "text-sp-yellow font-bold" :
                      log.includes("NEW POST") ? "text-sp-green font-bold" :
                      log.includes("Error") || log.includes("failed") ? "text-red-400" :
                      "text-sp-muted"
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 text-[10px] text-sp-muted">
          <strong>Note:</strong> If the proxy returns 403, Truth Social&apos;s Cloudflare is blocking server-side requests.
          Use the <a href="/setup" className="text-sp-blue hover:underline">bookmarklet setup</a> to run
          the poller directly from a truthsocial.com browser tab instead.
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { PostFeed } from "@/components/dashboard/PostFeed";
import { TradeHistory } from "@/components/dashboard/TradeHistory";
import { SystemStatus } from "@/components/dashboard/SystemStatus";
import { TestPanel } from "@/components/dashboard/TestPanel";
import { useSSE } from "@/hooks/useSSE";

interface StatusData {
  pipeline: {
    isRunning: boolean;
    queueLength: number;
    monitor: {
      isRunning: boolean;
      lastPollAt: string | null;
      lastPostAt: string | null;
      postsDetected: number;
      errors: number;
      currentStrategy: string;
    };
  };
  risk: {
    tradingHalted: boolean;
    dailyTradeCount: number;
    dailyPnl: number;
    consecutiveLosses: number;
    marketOpen: boolean;
  };
  counts: {
    posts: number;
    analyses: number;
    trades: number;
    errors: number;
  };
}

export default function Dashboard() {
  const { connected, lastEvent } = useSSE("/api/stream");
  const [posts, setPosts] = useState<Array<{
    id: string;
    createdAt: string;
    content: string;
    isRepost: boolean;
    url: string;
  }>>([]);
  const [analyses, setAnalyses] = useState<Array<{
    postId: string;
    impact: string;
    direction: string;
    confidence: number;
    reasoning: string;
    primaryInstrument: string;
    recommendedTrade: { action: string; instrument: string };
    latencyMs: number;
  }>>([]);
  const [trades, setTrades] = useState<Array<{
    id: string;
    timestamp: string;
    underlying: string;
    contractSymbol: string;
    type: "call" | "put";
    strike: number;
    expiration: string;
    quantity: number;
    entryPrice: number;
    currentPrice?: number;
    pnl?: number;
    status: string;
    analysis: {
      impact: string;
      direction: string;
      confidence: number;
      reasoning: string;
    };
    postContent: string;
  }>>([]);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [activeTab, setActiveTab] = useState<"feed" | "trades" | "test">("feed");

  // Fetch initial data
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setStatus(data);
      if (data.recentPosts) setPosts(data.recentPosts);
      if (data.recentAnalyses) setAnalyses(data.recentAnalyses);
      if (data.recentTrades) setTrades(data.recentTrades);
    } catch {
      // Will retry on next interval
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Process SSE events
  useEffect(() => {
    if (!lastEvent) return;
    const evt = lastEvent as { event: string; data: Record<string, unknown> };

    if (evt.event === "new-post" && evt.data?.post) {
      const post = evt.data.post as (typeof posts)[0];
      setPosts((prev) => [post, ...prev].slice(0, 50));
    }

    if (evt.event === "analysis-complete" && evt.data?.analysis) {
      const analysis = evt.data.analysis as (typeof analyses)[0];
      setAnalyses((prev) => [analysis, ...prev].slice(0, 50));
    }

    if (evt.event === "trade-executed" && evt.data?.trade) {
      const trade = evt.data.trade as (typeof trades)[0];
      setTrades((prev) => [trade, ...prev].slice(0, 50));
    }
  }, [lastEvent]);

  // Control actions
  const handleMonitorAction = async (action: "start" | "stop") => {
    await fetch("/api/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchStatus();
  };

  const handleTradeAction = async (action: "halt" | "resume") => {
    await fetch("/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchStatus();
  };

  const defaultStatus: StatusData = {
    pipeline: {
      isRunning: false,
      queueLength: 0,
      monitor: {
        isRunning: false,
        lastPollAt: null,
        lastPostAt: null,
        postsDetected: 0,
        errors: 0,
        currentStrategy: "none",
      },
    },
    risk: {
      tradingHalted: false,
      dailyTradeCount: 0,
      dailyPnl: 0,
      consecutiveLosses: 0,
      marketOpen: false,
    },
    counts: { posts: 0, analyses: 0, trades: 0, errors: 0 },
  };

  return (
    <div className="min-h-screen bg-sp-black">
      {/* Header */}
      <header className="border-b border-sp-border bg-sp-dark px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-sp-text tracking-tight">
              <span className="text-sp-green">SOCIAL</span>PROJECT
            </h1>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                connected
                  ? "bg-green-900/50 text-green-400"
                  : "bg-red-900/50 text-red-400"
              }`}
            >
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/setup"
              className="text-xs px-3 py-1 rounded font-bold bg-sp-blue/20 text-sp-blue hover:bg-sp-blue/30"
            >
              POLLER SETUP
            </a>

            <button
              onClick={() =>
                handleTradeAction(
                  status?.risk.tradingHalted ? "resume" : "halt"
                )
              }
              className={`text-xs px-3 py-1 rounded font-bold ${
                status?.risk.tradingHalted
                  ? "bg-yellow-900/50 text-yellow-400 hover:bg-yellow-900/70"
                  : "bg-red-900/50 text-red-400 hover:bg-red-900/70"
              }`}
            >
              {status?.risk.tradingHalted ? "RESUME" : "HALT"} TRADING
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column: Main content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-sp-dark rounded-lg p-1">
              {(["feed", "trades", "test"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
                    activeTab === tab
                      ? "bg-sp-panel text-sp-text"
                      : "text-sp-muted hover:text-sp-text"
                  }`}
                >
                  {tab === "feed" && `Posts (${posts.length})`}
                  {tab === "trades" && `Trades (${trades.length})`}
                  {tab === "test" && "Test Analyzer"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="bg-sp-panel border border-sp-border rounded-lg p-4">
              {activeTab === "feed" && (
                <PostFeed posts={posts} analyses={analyses} />
              )}
              {activeTab === "trades" && <TradeHistory trades={trades} />}
              {activeTab === "test" && <TestPanel />}
            </div>
          </div>

          {/* Right column: Status */}
          <div className="space-y-4">
            <div className="bg-sp-panel border border-sp-border rounded-lg p-4">
              <h2 className="text-xs font-bold text-sp-muted uppercase tracking-wider mb-3">
                System Status
              </h2>
              <SystemStatus
                data={{ ...(status || defaultStatus), connected }}
              />
            </div>

            {/* Quick Stats */}
            <div className="bg-sp-panel border border-sp-border rounded-lg p-4">
              <h2 className="text-xs font-bold text-sp-muted uppercase tracking-wider mb-3">
                Session Stats
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-sp-dark rounded p-2">
                  <div className="text-sp-muted">Posts</div>
                  <div className="text-xl font-bold text-sp-text font-mono">
                    {status?.counts.posts || 0}
                  </div>
                </div>
                <div className="bg-sp-dark rounded p-2">
                  <div className="text-sp-muted">Analyses</div>
                  <div className="text-xl font-bold text-sp-blue font-mono">
                    {status?.counts.analyses || 0}
                  </div>
                </div>
                <div className="bg-sp-dark rounded p-2">
                  <div className="text-sp-muted">Trades</div>
                  <div className="text-xl font-bold text-sp-green font-mono">
                    {status?.counts.trades || 0}
                  </div>
                </div>
                <div className="bg-sp-dark rounded p-2">
                  <div className="text-sp-muted">Errors</div>
                  <div className="text-xl font-bold text-sp-red font-mono">
                    {status?.counts.errors || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Info */}
            <div className="bg-sp-panel border border-sp-border rounded-lg p-4">
              <h2 className="text-xs font-bold text-sp-muted uppercase tracking-wider mb-3">
                Pipeline
              </h2>
              <div className="space-y-1.5 text-[10px] font-mono text-sp-muted">
                <div className="flex items-center gap-2">
                  <span className="text-sp-blue">01</span>
                  <span>Truth Social poll (3s interval)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sp-blue">02</span>
                  <span>Claude Sonnet analysis (&lt;1s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sp-blue">03</span>
                  <span>12-layer risk check</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sp-blue">04</span>
                  <span>Alpaca options execution</span>
                </div>
                <div className="mt-2 text-sp-green">
                  Target: &lt;3s post-to-order
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

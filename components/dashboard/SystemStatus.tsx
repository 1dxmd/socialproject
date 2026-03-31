"use client";

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
  connected: boolean;
}

function StatusDot({ active, color }: { active: boolean; color?: string }) {
  const c = color || (active ? "bg-sp-green" : "bg-sp-red");
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${c} ${active ? "live-pulse" : ""}`}
    />
  );
}

export function SystemStatus({ data }: { data: StatusData }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      {/* Connection */}
      <div className="bg-sp-dark rounded p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <StatusDot active={data.connected} />
          <span className="text-sp-muted">SSE</span>
        </div>
        <span className={data.connected ? "text-green-400" : "text-red-400"}>
          {data.connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Pipeline */}
      <div className="bg-sp-dark rounded p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <StatusDot active={data.pipeline.isRunning} />
          <span className="text-sp-muted">Pipeline</span>
        </div>
        <span
          className={
            data.pipeline.isRunning ? "text-green-400" : "text-red-400"
          }
        >
          {data.pipeline.isRunning ? "Running" : "Stopped"}
        </span>
      </div>

      {/* Monitor */}
      <div className="bg-sp-dark rounded p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <StatusDot active={data.pipeline.monitor.isRunning} />
          <span className="text-sp-muted">Monitor</span>
        </div>
        <div className="text-sp-text">
          {data.pipeline.monitor.currentStrategy.toUpperCase()}
        </div>
        <div className="text-sp-muted text-[10px]">
          {data.pipeline.monitor.postsDetected} detected
        </div>
      </div>

      {/* Market */}
      <div className="bg-sp-dark rounded p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <StatusDot
            active={data.risk.marketOpen}
            color={data.risk.marketOpen ? "bg-sp-green" : "bg-sp-yellow"}
          />
          <span className="text-sp-muted">Market</span>
        </div>
        <span
          className={data.risk.marketOpen ? "text-green-400" : "text-yellow-400"}
        >
          {data.risk.marketOpen ? "OPEN" : "CLOSED"}
        </span>
      </div>

      {/* Trading Status */}
      <div className="bg-sp-dark rounded p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <StatusDot
            active={!data.risk.tradingHalted}
            color={data.risk.tradingHalted ? "bg-sp-red" : "bg-sp-green"}
          />
          <span className="text-sp-muted">Trading</span>
        </div>
        <span
          className={
            data.risk.tradingHalted ? "text-red-400 font-bold" : "text-green-400"
          }
        >
          {data.risk.tradingHalted ? "HALTED" : "Active"}
        </span>
      </div>

      {/* Daily Stats */}
      <div className="bg-sp-dark rounded p-2">
        <div className="text-sp-muted mb-1">Today</div>
        <div className="font-mono">
          <span className="text-sp-text">{data.risk.dailyTradeCount}</span>
          <span className="text-sp-muted"> trades</span>
        </div>
        <div
          className={`font-mono font-bold ${
            data.risk.dailyPnl >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {data.risk.dailyPnl >= 0 ? "+" : ""}$
          {data.risk.dailyPnl.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

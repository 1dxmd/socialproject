"use client";

import { StatusBadge, ImpactBadge } from "@/components/ui/Badge";

interface Trade {
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
}

export function TradeHistory({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="text-sp-muted text-sm text-center py-8">
        No trades yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-sp-muted border-b border-sp-border">
            <th className="text-left py-2 px-2">Time</th>
            <th className="text-left py-2 px-2">Signal</th>
            <th className="text-left py-2 px-2">Contract</th>
            <th className="text-right py-2 px-2">Qty</th>
            <th className="text-right py-2 px-2">Entry</th>
            <th className="text-right py-2 px-2">P&L</th>
            <th className="text-left py-2 px-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr
              key={trade.id}
              className="border-b border-sp-border/50 hover:bg-sp-dark/50"
            >
              <td className="py-2 px-2 text-sp-muted font-mono">
                {new Date(trade.timestamp).toLocaleTimeString()}
              </td>
              <td className="py-2 px-2">
                <div className="flex items-center gap-1">
                  <ImpactBadge impact={trade.analysis.impact} />
                  <span
                    className={`font-bold ${
                      trade.type === "call" ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {trade.type === "call" ? "\u25B2" : "\u25BC"} {trade.underlying}
                  </span>
                </div>
              </td>
              <td className="py-2 px-2 font-mono text-sp-text">
                {trade.contractSymbol
                  ? `$${trade.strike} ${trade.type.toUpperCase()} ${trade.expiration}`
                  : "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono">
                {trade.quantity || "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono">
                {trade.entryPrice ? `$${trade.entryPrice.toFixed(2)}` : "—"}
              </td>
              <td
                className={`py-2 px-2 text-right font-mono font-bold ${
                  (trade.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {trade.pnl !== undefined
                  ? `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`
                  : "—"}
              </td>
              <td className="py-2 px-2">
                <StatusBadge status={trade.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

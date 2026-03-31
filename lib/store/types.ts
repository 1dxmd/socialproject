// ═══════════════════════════════════════════════════════════════
// STORE TYPES
// In-memory state with JSON file persistence
// ═══════════════════════════════════════════════════════════════

import type { TruthPost } from "@/lib/monitor/types";
import type { Analysis } from "@/lib/analyzer/types";
import type { TradeRecord } from "@/lib/trader/types";

export interface PnlSnapshot {
  timestamp: string;
  cumulativePnl: number;
  dailyPnl: number;
  openPositions: number;
}

export interface ErrorRecord {
  timestamp: string;
  module: string;
  message: string;
}

export interface StoreState {
  posts: TruthPost[];
  analyses: Analysis[];
  trades: TradeRecord[];
  pnl: PnlSnapshot[];
  errors: ErrorRecord[];
  lastPollAt: string | null;
  dailyLoss: number;
  tradingHalted: boolean;
}

// ═══════════════════════════════════════════════════════════════
// TRADING TYPES
// Orders, positions, risk config, and trade records
// ═══════════════════════════════════════════════════════════════

export interface OptionsContract {
  symbol: string; // e.g., "QQQ260403C00485000"
  underlying: string; // e.g., "QQQ"
  type: "call" | "put";
  strike: number;
  expirationDate: string; // YYYY-MM-DD
  bidPrice: number;
  askPrice: number;
  midPrice: number;
  openInterest: number;
  volume: number;
}

export interface TradeOrder {
  contractSymbol: string;
  underlying: string;
  side: "buy";
  type: "call" | "put";
  quantity: number;
  limitPrice: number;
  strike: number;
  expiration: string;
}

export interface TradeRecord {
  id: string;
  postId: string;
  orderId?: string;
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
  status: "pending" | "filled" | "partial" | "cancelled" | "rejected" | "error";
  analysis: {
    impact: string;
    direction: string;
    confidence: number;
    reasoning: string;
  };
  postContent: string;
}

export interface Position {
  symbol: string;
  underlying: string;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

export interface RiskCheck {
  allowed: boolean;
  reason?: string;
}

export interface AccountInfo {
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  dayTradeCount: number;
}

// ═══════════════════════════════════════════════════════════════
// ANALYSIS TYPES
// Structured output from Claude market impact analysis
// ═══════════════════════════════════════════════════════════════

export type ImpactLevel = "none" | "low" | "medium" | "high" | "critical";
export type Direction = "bullish" | "bearish" | "mixed";
export type Urgency = "immediate" | "minutes" | "hours" | "days";
export type TradeAction = "buy_calls" | "buy_puts" | "none";
export type PositionSize = "small" | "medium" | "large";

export interface RecommendedTrade {
  action: TradeAction;
  instrument: string; // e.g., "QQQ", "AAPL", "XLE"
  size: PositionSize;
  reasoning: string;
}

export interface Analysis {
  // Core assessment
  impact: ImpactLevel;
  direction: Direction;
  confidence: number; // 0.0 - 1.0
  urgency: Urgency;

  // Market specifics
  affectedInstruments: string[]; // Ticker symbols
  primaryInstrument: string; // The single best instrument to trade
  sector: string; // e.g., "technology", "energy", "broad_market"

  // Reasoning
  reasoning: string;
  keyPhrases: string[]; // Specific phrases from the post that drove the analysis

  // Trade recommendation
  recommendedTrade: RecommendedTrade;

  // Meta
  isNewInformation: boolean; // vs repeating known policy
  postId: string;
  analyzedAt: string;
  latencyMs: number; // Time to analyze
}

export interface AnalysisResult {
  success: boolean;
  analysis?: Analysis;
  error?: string;
  rawResponse?: string;
}

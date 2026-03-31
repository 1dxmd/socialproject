// ═══════════════════════════════════════════════════════════════
// CENTRALIZED CONFIGURATION
// All env vars validated and typed in one place
// ═══════════════════════════════════════════════════════════════

export interface AppConfig {
  // API Keys
  anthropicApiKey: string;
  alpacaApiKey: string;
  alpacaApiSecret: string;
  alpacaBaseUrl: string;
  alpacaDataUrl: string;

  // Truth Social
  truthSocialAccountId: string;

  // Monitor
  pollIntervalMs: number;

  // Trading
  tradingEnabled: boolean;
  paperMode: boolean;
  autoExecute: boolean;
  maxPositionValue: number;
  dailyLossLimit: number;
  maxDailyTrades: number;
  maxConcurrentPositions: number;
  confidenceThreshold: number;
  minImpactLevel: "low" | "medium" | "high" | "critical";
}

export function loadConfig(): AppConfig {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    alpacaApiKey: process.env.ALPACA_API_KEY || "",
    alpacaApiSecret: process.env.ALPACA_API_SECRET || "",
    alpacaBaseUrl:
      process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets",
    alpacaDataUrl:
      process.env.ALPACA_DATA_URL || "https://data.alpaca.markets",
    truthSocialAccountId:
      process.env.TRUTH_SOCIAL_ACCOUNT_ID || "107780257626128497",
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "3000", 10),
    tradingEnabled: process.env.TRADING_ENABLED === "true",
    paperMode: process.env.PAPER_MODE !== "false", // default true
    autoExecute: process.env.AUTO_EXECUTE === "true",
    maxPositionValue: parseFloat(process.env.MAX_POSITION_VALUE || "500"),
    dailyLossLimit: parseFloat(process.env.DAILY_LOSS_LIMIT || "2000"),
    maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES || "20", 10),
    maxConcurrentPositions: parseInt(
      process.env.MAX_CONCURRENT_POSITIONS || "5",
      10
    ),
    confidenceThreshold: parseFloat(
      process.env.CONFIDENCE_THRESHOLD || "0.7"
    ),
    minImpactLevel: (process.env.MIN_IMPACT_LEVEL as AppConfig["minImpactLevel"]) || "high",
  };
}

// Singleton config
let _config: AppConfig | null = null;
export function getConfig(): AppConfig {
  if (!_config) _config = loadConfig();
  return _config;
}

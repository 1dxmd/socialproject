// ═══════════════════════════════════════════════════════════════
// RISK MANAGER
// Multi-layer safety system preventing runaway losses
// Every trade must pass ALL checks before execution
// ═══════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import { getConfig } from "@/lib/config";
import { getAccount, getPositions } from "./alpaca-client";
import type { RiskCheck } from "./types";
import type { Analysis } from "@/lib/analyzer/types";

const MODULE = "RiskManager";

// State tracking
let dailyTradeCount = 0;
let dailyPnl = 0;
let consecutiveLosses = 0;
let tradingHalted = false;
let lastTradeTimestamps: Map<string, number> = new Map();
let lastResetDate = new Date().toDateString();

// Impact level ordering
const IMPACT_LEVELS: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function resetDailyCountersIfNeeded() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyTradeCount = 0;
    dailyPnl = 0;
    tradingHalted = false;
    lastResetDate = today;
    logger.info(MODULE, "Daily counters reset");
  }
}

export function isMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const day = et.getDay();
  const timeMinutes = hours * 60 + minutes;

  // Mon-Fri, 9:30 AM - 4:00 PM ET
  return day >= 1 && day <= 5 && timeMinutes >= 570 && timeMinutes < 960;
}

export async function checkRisk(analysis: Analysis): Promise<RiskCheck> {
  const config = getConfig();
  resetDailyCountersIfNeeded();

  // ─── Check 1: Trading enabled ──────────────────────────────
  if (!config.tradingEnabled) {
    return { allowed: false, reason: "Trading is disabled in config" };
  }

  if (!config.autoExecute) {
    return { allowed: false, reason: "Auto-execute is disabled — signal logged only" };
  }

  // ─── Check 2: Kill switch ─────────────────────────────────
  if (tradingHalted) {
    return { allowed: false, reason: "Trading halted (kill switch or daily loss limit)" };
  }

  // ─── Check 3: Market hours ─────────────────────────────────
  if (!isMarketOpen()) {
    return { allowed: false, reason: "Market is closed" };
  }

  // ─── Check 4: Impact threshold ─────────────────────────────
  const impactLevel = IMPACT_LEVELS[analysis.impact] ?? 0;
  const minLevel = IMPACT_LEVELS[config.minImpactLevel] ?? 3;
  if (impactLevel < minLevel) {
    return {
      allowed: false,
      reason: `Impact "${analysis.impact}" below threshold "${config.minImpactLevel}"`,
    };
  }

  // ─── Check 5: Confidence threshold ─────────────────────────
  if (analysis.confidence < config.confidenceThreshold) {
    return {
      allowed: false,
      reason: `Confidence ${analysis.confidence} below threshold ${config.confidenceThreshold}`,
    };
  }

  // ─── Check 6: Trade action exists ──────────────────────────
  if (analysis.recommendedTrade.action === "none") {
    return { allowed: false, reason: "Analysis recommends no trade" };
  }

  // ─── Check 7: Daily trade count ────────────────────────────
  if (dailyTradeCount >= config.maxDailyTrades) {
    return {
      allowed: false,
      reason: `Daily trade limit reached (${config.maxDailyTrades})`,
    };
  }

  // ─── Check 8: Daily loss limit ─────────────────────────────
  if (Math.abs(dailyPnl) >= config.dailyLossLimit && dailyPnl < 0) {
    tradingHalted = true;
    return {
      allowed: false,
      reason: `Daily loss limit breached ($${dailyPnl.toFixed(2)})`,
    };
  }

  // ─── Check 9: Consecutive loss circuit breaker ─────────────
  if (consecutiveLosses >= 3) {
    return {
      allowed: false,
      reason: `Circuit breaker: ${consecutiveLosses} consecutive losses`,
    };
  }

  // ─── Check 10: Cooldown per instrument ─────────────────────
  const instrument = analysis.recommendedTrade.instrument;
  const lastTrade = lastTradeTimestamps.get(instrument);
  if (lastTrade) {
    const cooldownMs = 15 * 60 * 1000; // 15 minutes
    const elapsed = Date.now() - lastTrade;
    if (elapsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsed) / 60000);
      return {
        allowed: false,
        reason: `Cooldown active for ${instrument} (${remaining}min remaining)`,
      };
    }
  }

  // ─── Check 11: Max concurrent positions ────────────────────
  const positionsResult = await getPositions();
  if (positionsResult.data && positionsResult.data.length >= config.maxConcurrentPositions) {
    return {
      allowed: false,
      reason: `Max concurrent positions reached (${config.maxConcurrentPositions})`,
    };
  }

  // ─── Check 12: Buying power ────────────────────────────────
  const accountResult = await getAccount();
  if (accountResult.data && accountResult.data.buyingPower < config.maxPositionValue) {
    return {
      allowed: false,
      reason: `Insufficient buying power ($${accountResult.data.buyingPower.toFixed(2)})`,
    };
  }

  // ─── All checks passed ────────────────────────────────────
  logger.info(MODULE, `Risk check PASSED for ${instrument} (${analysis.impact}, conf=${analysis.confidence})`);
  return { allowed: true };
}

// Called after each trade execution
export function recordTradeResult(instrument: string, pnl: number) {
  dailyTradeCount++;
  dailyPnl += pnl;
  lastTradeTimestamps.set(instrument, Date.now());

  if (pnl < 0) {
    consecutiveLosses++;
  } else {
    consecutiveLosses = 0;
  }
}

// Manual kill switch
export function haltTrading(reason: string) {
  tradingHalted = true;
  logger.warn(MODULE, `Trading HALTED: ${reason}`);
}

export function resumeTrading() {
  tradingHalted = false;
  consecutiveLosses = 0;
  logger.info(MODULE, "Trading RESUMED");
}

export function getRiskStatus() {
  resetDailyCountersIfNeeded();
  return {
    tradingHalted,
    dailyTradeCount,
    dailyPnl,
    consecutiveLosses,
    marketOpen: isMarketOpen(),
  };
}

// ═══════════════════════════════════════════════════════════════
// CONTRACT PICKER
// Selects the optimal options contract for a given trade signal
// Strategy: nearest weekly expiry (2+ days out), slightly OTM
// ═══════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import { getOptionsContracts, getStockPrice, getOptionQuote } from "./alpaca-client";
import type { OptionsContract, TradeOrder } from "./types";
import type { Analysis } from "@/lib/analyzer/types";

const MODULE = "ContractPicker";

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export async function pickContract(
  analysis: Analysis
): Promise<{ order?: TradeOrder; error?: string }> {
  const underlying = analysis.recommendedTrade.instrument;
  const action = analysis.recommendedTrade.action;

  if (action === "none") {
    return { error: "No trade recommended" };
  }

  const optionType = action === "buy_calls" ? "call" : "put";

  // Get current stock price
  const priceResult = await getStockPrice(underlying);
  if (!priceResult) {
    return { error: `Could not get price for ${underlying}` };
  }

  const currentPrice = priceResult.price;
  logger.info(MODULE, `${underlying} current price: $${currentPrice.toFixed(2)}`);

  // Target strike: slightly OTM for leverage
  // Calls: 1-2% above current price
  // Puts: 1-2% below current price
  const otmOffset = optionType === "call" ? 1.015 : 0.985;
  const targetStrike = Math.round((currentPrice * otmOffset) * 2) / 2; // Round to nearest $0.50

  // Find contracts: expiring 2-14 days out
  const today = new Date();
  const minExpiry = addDays(today, 2);
  const maxExpiry = addDays(today, 14);

  const contractsResult = await getOptionsContracts({
    underlying,
    type: optionType,
    expirationDateGte: minExpiry,
    expirationDateLte: maxExpiry,
    strikeGte: optionType === "call" ? currentPrice * 0.97 : currentPrice * 0.9,
    strikeLte: optionType === "call" ? currentPrice * 1.1 : currentPrice * 1.03,
    limit: 50,
  });

  if (contractsResult.error || !contractsResult.data?.length) {
    return {
      error: `No ${optionType} contracts found for ${underlying}: ${contractsResult.error || "empty"}`,
    };
  }

  const contracts = contractsResult.data;
  logger.info(MODULE, `Found ${contracts.length} ${optionType} contracts for ${underlying}`);

  // Score contracts: prefer nearest expiry + close to target strike + good open interest
  const scored = contracts.map((c) => {
    const strikeDiff = Math.abs(c.strike - targetStrike);
    const expiryDays = Math.max(
      1,
      (new Date(c.expirationDate).getTime() - today.getTime()) / 86400000
    );

    // Lower score = better
    const score =
      strikeDiff * 2 + // Penalize distance from target strike
      expiryDays * 0.5 + // Prefer sooner expiry (but not too soon)
      (c.openInterest < 100 ? 50 : 0); // Heavy penalty for illiquid contracts

    return { contract: c, score };
  });

  scored.sort((a, b) => a.score - b.score);
  const best = scored[0].contract;

  // Get live quote for the selected contract
  const quote = await getOptionQuote(best.symbol);
  const limitPrice = quote ? quote.mid : best.midPrice;

  if (limitPrice <= 0) {
    return { error: `Invalid price for ${best.symbol}: $${limitPrice}` };
  }

  // Determine quantity based on position size recommendation
  const { getConfig } = await import("@/lib/config");
  const config = getConfig();
  const maxValue = config.maxPositionValue;
  const contractCost = limitPrice * 100; // Options are 100 shares per contract
  const quantity = Math.max(1, Math.floor(maxValue / contractCost));

  const order: TradeOrder = {
    contractSymbol: best.symbol,
    underlying,
    side: "buy",
    type: optionType,
    quantity,
    limitPrice: Math.round(limitPrice * 100) / 100,
    strike: best.strike,
    expiration: best.expirationDate,
  };

  logger.signal(
    MODULE,
    `Selected: ${order.quantity}x ${order.contractSymbol} @ $${order.limitPrice} (${optionType} $${best.strike} exp ${best.expirationDate})`
  );

  return { order };
}

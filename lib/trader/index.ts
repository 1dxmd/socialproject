// ═══════════════════════════════════════════════════════════════
// TRADER SERVICE
// Orchestrates the full trade execution pipeline:
// Risk check → Contract selection → Order placement → Monitoring
// ═══════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import { checkRisk, recordTradeResult } from "./risk-manager";
import { pickContract } from "./contract-picker";
import { placeOrder, getOrderStatus, cancelOrder } from "./alpaca-client";
import type { TradeRecord } from "./types";
import type { Analysis } from "@/lib/analyzer/types";
import type { TruthPost } from "@/lib/monitor/types";

const MODULE = "Trader";

export async function executeTrade(
  analysis: Analysis,
  post: TruthPost
): Promise<TradeRecord> {
  const startMs = Date.now();
  const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const baseRecord: TradeRecord = {
    id: tradeId,
    postId: post.id,
    timestamp: new Date().toISOString(),
    underlying: analysis.recommendedTrade.instrument,
    contractSymbol: "",
    type: analysis.recommendedTrade.action === "buy_calls" ? "call" : "put",
    strike: 0,
    expiration: "",
    quantity: 0,
    entryPrice: 0,
    status: "pending",
    analysis: {
      impact: analysis.impact,
      direction: analysis.direction,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
    },
    postContent: post.content.substring(0, 500),
  };

  // ─── Step 1: Risk check ────────────────────────────────────
  const riskResult = await checkRisk(analysis);
  if (!riskResult.allowed) {
    logger.signal(MODULE, `Trade blocked by risk manager: ${riskResult.reason}`);
    return {
      ...baseRecord,
      status: "cancelled",
    };
  }

  // ─── Step 2: Pick contract ─────────────────────────────────
  const contractResult = await pickContract(analysis);
  if (contractResult.error || !contractResult.order) {
    logger.error(MODULE, `Contract selection failed: ${contractResult.error}`);
    return {
      ...baseRecord,
      status: "error",
    };
  }

  const order = contractResult.order;
  baseRecord.contractSymbol = order.contractSymbol;
  baseRecord.strike = order.strike;
  baseRecord.expiration = order.expiration;
  baseRecord.quantity = order.quantity;
  baseRecord.entryPrice = order.limitPrice;

  // ─── Step 3: Place order ───────────────────────────────────
  const orderResult = await placeOrder(order);
  if (orderResult.error || !orderResult.orderId) {
    logger.error(MODULE, `Order placement failed: ${orderResult.error}`);
    return {
      ...baseRecord,
      status: "rejected",
    };
  }

  baseRecord.orderId = orderResult.orderId;

  // ─── Step 4: Monitor fill (poll for 30s, then cancel) ─────
  const FILL_TIMEOUT_MS = 30000;
  const POLL_INTERVAL_MS = 2000;
  const deadline = Date.now() + FILL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const status = await getOrderStatus(orderResult.orderId);

    if (status.status === "filled") {
      const fillPrice = status.filledPrice || order.limitPrice;
      const latencyMs = Date.now() - startMs;

      logger.trade(
        MODULE,
        `FILLED: ${order.quantity}x ${order.contractSymbol} @ $${fillPrice} (${latencyMs}ms total)`
      );

      recordTradeResult(order.underlying, 0); // PnL unknown at fill time

      return {
        ...baseRecord,
        entryPrice: fillPrice,
        status: "filled",
      };
    }

    if (status.status === "cancelled" || status.status === "rejected") {
      return {
        ...baseRecord,
        status: status.status as TradeRecord["status"],
      };
    }

    if (status.status === "partially_filled") {
      baseRecord.status = "partial";
    }
  }

  // Timeout: cancel unfilled order
  logger.warn(MODULE, `Order ${orderResult.orderId} not filled in ${FILL_TIMEOUT_MS}ms, cancelling`);
  await cancelOrder(orderResult.orderId);

  return {
    ...baseRecord,
    status: baseRecord.status === "partial" ? "partial" : "cancelled",
  };
}

export type { TradeRecord };

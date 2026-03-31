// ═══════════════════════════════════════════════════════════════
// ALPACA REST CLIENT
// Thin wrapper for Alpaca Trading API — options trading
// Handles auth, request formatting, and error handling
// ═══════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";
import { getConfig } from "@/lib/config";
import type {
  OptionsContract,
  TradeOrder,
  Position,
  AccountInfo,
} from "./types";

const MODULE = "Alpaca";

async function alpacaFetch<T>(
  path: string,
  options: RequestInit = {},
  useDataUrl = false
): Promise<{ data?: T; error?: string }> {
  const config = getConfig();
  const baseUrl = useDataUrl ? config.alpacaDataUrl : config.alpacaBaseUrl;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "APCA-API-KEY-ID": config.alpacaApiKey,
        "APCA-API-SECRET-KEY": config.alpacaApiSecret,
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { error: `Alpaca ${response.status}: ${text.substring(0, 300)}` };
    }

    const data = (await response.json()) as T;
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Alpaca request failed: ${message}` };
  }
}

// ─── Account ─────────────────────────────────────────────────

export async function getAccount(): Promise<{
  data?: AccountInfo;
  error?: string;
}> {
  const result = await alpacaFetch<{
    buying_power: string;
    cash: string;
    portfolio_value: string;
    daytrade_count: number;
  }>("/v2/account");

  if (result.error || !result.data) return { error: result.error };

  return {
    data: {
      buyingPower: parseFloat(result.data.buying_power),
      cash: parseFloat(result.data.cash),
      portfolioValue: parseFloat(result.data.portfolio_value),
      dayTradeCount: result.data.daytrade_count,
    },
  };
}

// ─── Options Chain ───────────────────────────────────────────

export async function getOptionsContracts(params: {
  underlying: string;
  type: "call" | "put";
  expirationDateGte?: string;
  expirationDateLte?: string;
  strikeGte?: number;
  strikeLte?: number;
  limit?: number;
}): Promise<{ data?: OptionsContract[]; error?: string }> {
  const searchParams = new URLSearchParams({
    underlying_symbols: params.underlying,
    type: params.type,
    status: "active",
    limit: String(params.limit || 50),
  });

  if (params.expirationDateGte)
    searchParams.set("expiration_date_gte", params.expirationDateGte);
  if (params.expirationDateLte)
    searchParams.set("expiration_date_lte", params.expirationDateLte);
  if (params.strikeGte)
    searchParams.set("strike_price_gte", String(params.strikeGte));
  if (params.strikeLte)
    searchParams.set("strike_price_lte", String(params.strikeLte));

  const result = await alpacaFetch<{
    option_contracts: Array<{
      symbol: string;
      underlying_symbol: string;
      type: string;
      strike_price: string;
      expiration_date: string;
      open_interest: string;
      close_price: string;
    }>;
  }>(`/v2/options/contracts?${searchParams}`);

  if (result.error || !result.data) return { error: result.error };

  const contracts: OptionsContract[] = (
    result.data.option_contracts || []
  ).map((c) => ({
    symbol: c.symbol,
    underlying: c.underlying_symbol,
    type: c.type as "call" | "put",
    strike: parseFloat(c.strike_price),
    expirationDate: c.expiration_date,
    bidPrice: 0, // Will be filled by snapshot
    askPrice: 0,
    midPrice: parseFloat(c.close_price || "0"),
    openInterest: parseInt(c.open_interest || "0", 10),
    volume: 0,
  }));

  return { data: contracts };
}

// ─── Get latest quote for option contract ────────────────────

export async function getOptionQuote(
  symbol: string
): Promise<{ bid: number; ask: number; mid: number } | null> {
  const result = await alpacaFetch<{
    quotes: Record<
      string,
      { bp: number; ap: number; bs: number; as: number }
    >;
  }>(`/v1beta1/options/quotes/latest?symbols=${symbol}&feed=indicative`, {}, true);

  if (result.error || !result.data?.quotes?.[symbol]) return null;

  const q = result.data.quotes[symbol];
  return {
    bid: q.bp,
    ask: q.ap,
    mid: (q.bp + q.ap) / 2,
  };
}

// ─── Place Order ─────────────────────────────────────────────

export async function placeOrder(order: TradeOrder): Promise<{
  orderId?: string;
  error?: string;
}> {
  logger.trade(MODULE, `Placing order: ${order.side} ${order.quantity}x ${order.contractSymbol} @ $${order.limitPrice}`);

  const result = await alpacaFetch<{ id: string; status: string }>(
    "/v2/orders",
    {
      method: "POST",
      body: JSON.stringify({
        symbol: order.contractSymbol,
        qty: String(order.quantity),
        side: order.side,
        type: "limit",
        time_in_force: "day",
        limit_price: String(order.limitPrice),
      }),
    }
  );

  if (result.error || !result.data) {
    logger.error(MODULE, `Order failed: ${result.error}`);
    return { error: result.error };
  }

  logger.trade(MODULE, `Order placed: ${result.data.id} — status: ${result.data.status}`);
  return { orderId: result.data.id };
}

// ─── Get Order Status ────────────────────────────────────────

export async function getOrderStatus(
  orderId: string
): Promise<{ status: string; filledPrice?: number; error?: string }> {
  const result = await alpacaFetch<{
    status: string;
    filled_avg_price: string;
  }>(`/v2/orders/${orderId}`);

  if (result.error || !result.data) return { status: "unknown", error: result.error };

  return {
    status: result.data.status,
    filledPrice: result.data.filled_avg_price
      ? parseFloat(result.data.filled_avg_price)
      : undefined,
  };
}

// ─── Cancel Order ────────────────────────────────────────────

export async function cancelOrder(orderId: string): Promise<{ error?: string }> {
  const result = await alpacaFetch(`/v2/orders/${orderId}`, {
    method: "DELETE",
  });
  return { error: result.error };
}

// ─── Positions ───────────────────────────────────────────────

export async function getPositions(): Promise<{
  data?: Position[];
  error?: string;
}> {
  const result = await alpacaFetch<
    Array<{
      symbol: string;
      qty: string;
      avg_entry_price: string;
      current_price: string;
      market_value: string;
      unrealized_pl: string;
    }>
  >("/v2/positions");

  if (result.error || !result.data) return { error: result.error };

  const positions: Position[] = result.data.map((p) => ({
    symbol: p.symbol,
    underlying: p.symbol.substring(0, 3), // Approximate
    quantity: parseInt(p.qty, 10),
    avgEntryPrice: parseFloat(p.avg_entry_price),
    currentPrice: parseFloat(p.current_price),
    marketValue: parseFloat(p.market_value),
    unrealizedPnl: parseFloat(p.unrealized_pl),
  }));

  return { data: positions };
}

// ─── Get current stock price ─────────────────────────────────

export async function getStockPrice(
  symbol: string
): Promise<{ price: number } | null> {
  const result = await alpacaFetch<{
    trades: Record<string, { p: number }>;
  }>(`/v2/stocks/${symbol}/trades/latest`, {}, true);

  if (result.error || !result.data?.trades?.[symbol]) {
    // Try bars endpoint
    const barResult = await alpacaFetch<{
      bars: Record<string, { c: number }>;
    }>(`/v1beta3/stocks/${symbol}/bars/latest?feed=iex`, {}, true);

    if (barResult.data?.bars?.[symbol]) {
      return { price: barResult.data.bars[symbol].c };
    }
    return null;
  }

  return { price: result.data.trades[symbol].p };
}

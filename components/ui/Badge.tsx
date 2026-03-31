"use client";

const IMPACT_COLORS: Record<string, string> = {
  none: "bg-gray-700 text-gray-300",
  low: "bg-green-900/50 text-green-400 border border-green-700/50",
  medium: "bg-yellow-900/50 text-yellow-400 border border-yellow-700/50",
  high: "bg-orange-900/50 text-orange-400 border border-orange-700/50 glow-high",
  critical: "bg-red-900/50 text-red-400 border border-red-700/50 glow-critical",
};

const DIRECTION_COLORS: Record<string, string> = {
  bullish: "bg-green-900/50 text-green-400",
  bearish: "bg-red-900/50 text-red-400",
  mixed: "bg-yellow-900/50 text-yellow-400",
};

const STATUS_COLORS: Record<string, string> = {
  filled: "bg-green-900/50 text-green-400",
  pending: "bg-yellow-900/50 text-yellow-400",
  cancelled: "bg-gray-700 text-gray-400",
  rejected: "bg-red-900/50 text-red-400",
  error: "bg-red-900/50 text-red-400",
  partial: "bg-orange-900/50 text-orange-400",
};

export function ImpactBadge({ impact }: { impact: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${IMPACT_COLORS[impact] || IMPACT_COLORS.none}`}
    >
      {impact}
    </span>
  );
}

export function DirectionBadge({ direction }: { direction: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${DIRECTION_COLORS[direction] || "bg-gray-700 text-gray-400"}`}
    >
      {direction === "bullish" ? "\u25B2" : direction === "bearish" ? "\u25BC" : "\u25C6"}{" "}
      {direction}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${STATUS_COLORS[status] || "bg-gray-700 text-gray-400"}`}
    >
      {status}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80
      ? "text-green-400"
      : pct >= 60
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <span className={`text-xs font-mono ${color}`}>{pct}%</span>
  );
}

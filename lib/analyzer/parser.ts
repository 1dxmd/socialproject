// ═══════════════════════════════════════════════════════════════
// ANALYSIS RESPONSE PARSER
// Validates Claude's JSON output against Zod schema
// Handles malformed responses gracefully
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";
import type { Analysis } from "./types";

const AnalysisSchema = z.object({
  impact: z.enum(["none", "low", "medium", "high", "critical"]),
  direction: z.enum(["bullish", "bearish", "mixed"]),
  confidence: z.number().min(0).max(1),
  urgency: z.enum(["immediate", "minutes", "hours", "days"]),
  affected_instruments: z.array(z.string()),
  primary_instrument: z.string(),
  sector: z.string(),
  reasoning: z.string(),
  key_phrases: z.array(z.string()),
  recommended_trade: z.object({
    action: z.enum(["buy_calls", "buy_puts", "none"]),
    instrument: z.string(),
    size: z.enum(["small", "medium", "large"]),
    reasoning: z.string(),
  }),
  is_new_information: z.boolean(),
});

export function parseAnalysisResponse(
  raw: string,
  postId: string,
  latencyMs: number
): { analysis?: Analysis; error?: string } {
  try {
    // Strip markdown code fences if Claude wraps the response
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "");
    }

    const parsed = JSON.parse(cleaned);
    const validated = AnalysisSchema.parse(parsed);

    const analysis: Analysis = {
      impact: validated.impact,
      direction: validated.direction,
      confidence: validated.confidence,
      urgency: validated.urgency,
      affectedInstruments: validated.affected_instruments,
      primaryInstrument: validated.primary_instrument,
      sector: validated.sector,
      reasoning: validated.reasoning,
      keyPhrases: validated.key_phrases,
      recommendedTrade: {
        action: validated.recommended_trade.action,
        instrument: validated.recommended_trade.instrument,
        size: validated.recommended_trade.size,
        reasoning: validated.recommended_trade.reasoning,
      },
      isNewInformation: validated.is_new_information,
      postId,
      analyzedAt: new Date().toISOString(),
      latencyMs,
    };

    return { analysis };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Parse failed: ${message}. Raw: ${raw.substring(0, 300)}` };
  }
}

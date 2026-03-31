"use client";

import { useState } from "react";
import { ImpactBadge, DirectionBadge, ConfidenceBadge } from "@/components/ui/Badge";

interface AnalysisResponse {
  success: boolean;
  analysis?: {
    impact: string;
    direction: string;
    confidence: number;
    urgency: string;
    affectedInstruments: string[];
    primaryInstrument: string;
    reasoning: string;
    recommendedTrade: {
      action: string;
      instrument: string;
      size: string;
      reasoning: string;
    };
    isNewInformation: boolean;
    latencyMs: number;
  };
  error?: string;
}

const SAMPLE_POSTS = [
  "I am ordering a 50% tariff on all goods from the European Union. They have been taking advantage of us for years. This ends NOW!",
  "Happy Birthday to our great First Lady, Melania! You are amazing!",
  "Just spoke with Tim Cook of Apple. They will invest $500 BILLION in the United States over the next 4 years. Incredible!",
  "The stock market is at an ALL TIME HIGH! Thank you President Trump!",
  "DRILL BABY DRILL! Signing an Executive Order today to open ALL federal lands for energy production!",
  "China is manipulating their currency again. If they don't stop, there will be major consequences!",
];

export function TestPanel() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const analyze = async (postText: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postText }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Request failed",
      });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      {/* Input */}
      <textarea
        className="w-full bg-sp-dark border border-sp-border rounded-lg p-3 text-sm text-sp-text resize-none focus:outline-none focus:border-sp-blue"
        rows={3}
        placeholder="Paste or type a Trump post to test analysis..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex gap-2">
        <button
          onClick={() => analyze(text)}
          disabled={!text.trim() || loading}
          className="px-4 py-1.5 bg-sp-blue text-white rounded text-xs font-bold hover:bg-sp-blue/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {/* Sample posts */}
      <div>
        <div className="text-[10px] text-sp-muted mb-1.5 uppercase tracking-wider">
          Sample Posts
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_POSTS.map((sample, i) => (
            <button
              key={i}
              onClick={() => {
                setText(sample);
                analyze(sample);
              }}
              className="text-[10px] bg-sp-dark border border-sp-border rounded px-2 py-1 text-sp-muted hover:text-sp-text hover:border-sp-blue/50 transition-colors truncate max-w-[200px]"
            >
              {sample.substring(0, 50)}...
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-sp-dark border border-sp-border rounded-lg p-3 animate-fade-in">
          {result.success && result.analysis ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <ImpactBadge impact={result.analysis.impact} />
                <DirectionBadge direction={result.analysis.direction} />
                <ConfidenceBadge confidence={result.analysis.confidence} />
                <span className="text-[10px] text-sp-muted">
                  {result.analysis.latencyMs}ms
                </span>
                <span className="text-[10px] text-sp-muted">
                  urgency: {result.analysis.urgency}
                </span>
              </div>

              <p className="text-xs text-sp-text">{result.analysis.reasoning}</p>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-sp-muted">Instruments:</span>
                {result.analysis.affectedInstruments.map((inst) => (
                  <span
                    key={inst}
                    className="text-[10px] font-mono bg-sp-panel px-1.5 py-0.5 rounded text-sp-cyan"
                  >
                    ${inst}
                  </span>
                ))}
              </div>

              {result.analysis.recommendedTrade.action !== "none" && (
                <div
                  className={`text-xs font-bold p-2 rounded ${
                    result.analysis.recommendedTrade.action === "buy_calls"
                      ? "bg-green-900/30 text-green-400"
                      : "bg-red-900/30 text-red-400"
                  }`}
                >
                  TRADE: {result.analysis.recommendedTrade.action.replace("_", " ").toUpperCase()}{" "}
                  {result.analysis.recommendedTrade.instrument} ({result.analysis.recommendedTrade.size})
                  <div className="font-normal text-[10px] mt-0.5 opacity-80">
                    {result.analysis.recommendedTrade.reasoning}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-sp-muted">
                New information: {result.analysis.isNewInformation ? "Yes" : "No (repeated theme)"}
              </div>
            </div>
          ) : (
            <div className="text-red-400 text-xs">
              Error: {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

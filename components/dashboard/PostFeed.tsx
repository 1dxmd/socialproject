"use client";

import { ImpactBadge, DirectionBadge, ConfidenceBadge } from "@/components/ui/Badge";

interface Post {
  id: string;
  createdAt: string;
  content: string;
  isRepost: boolean;
  url: string;
}

interface Analysis {
  postId: string;
  impact: string;
  direction: string;
  confidence: number;
  reasoning: string;
  primaryInstrument: string;
  recommendedTrade: {
    action: string;
    instrument: string;
  };
  latencyMs: number;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function PostFeed({
  posts,
  analyses,
}: {
  posts: Post[];
  analyses: Analysis[];
}) {
  const analysisMap = new Map(analyses.map((a) => [a.postId, a]));

  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-200px)]">
      {posts.length === 0 && (
        <div className="text-sp-muted text-sm text-center py-8">
          Waiting for posts...
        </div>
      )}

      {posts.map((post) => {
        const analysis = analysisMap.get(post.id);

        return (
          <div
            key={post.id}
            className="bg-sp-panel border border-sp-border rounded-lg p-3 animate-fade-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sp-blue font-bold text-xs">
                  @realDonaldTrump
                </span>
                {post.isRepost && (
                  <span className="text-[10px] text-sp-muted bg-sp-dark px-1.5 py-0.5 rounded">
                    REPOST
                  </span>
                )}
              </div>
              <span className="text-[10px] text-sp-muted">
                {timeAgo(post.createdAt)}
              </span>
            </div>

            {/* Post content */}
            <p className="text-sm text-sp-text leading-relaxed mb-2">
              {post.content}
            </p>

            {/* Analysis overlay */}
            {analysis && (
              <div className="bg-sp-dark rounded p-2 mt-2 border-l-2 border-sp-blue">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <ImpactBadge impact={analysis.impact} />
                  <DirectionBadge direction={analysis.direction} />
                  <ConfidenceBadge confidence={analysis.confidence} />
                  {analysis.primaryInstrument && (
                    <span className="text-xs font-mono text-sp-cyan bg-sp-panel px-1.5 py-0.5 rounded">
                      ${analysis.primaryInstrument}
                    </span>
                  )}
                  {analysis.recommendedTrade.action !== "none" && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        analysis.recommendedTrade.action === "buy_calls"
                          ? "bg-green-900/50 text-green-400"
                          : "bg-red-900/50 text-red-400"
                      }`}
                    >
                      {analysis.recommendedTrade.action === "buy_calls"
                        ? "BUY CALLS"
                        : "BUY PUTS"}{" "}
                      {analysis.recommendedTrade.instrument}
                    </span>
                  )}
                  <span className="text-[10px] text-sp-muted">
                    {analysis.latencyMs}ms
                  </span>
                </div>
                <p className="text-[11px] text-sp-muted leading-relaxed">
                  {analysis.reasoning}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

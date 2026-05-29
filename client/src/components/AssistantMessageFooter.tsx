import { Clock, Sparkles, Zap } from "lucide-react";
import { GEMINI_MODEL_LABEL } from "@/lib/aiConfig";

export function AssistantMessageFooter({
  source,
  executionTime,
  cached,
  cachedAt,
}: {
  source: string | null;
  executionTime?: number;
  cached?: boolean;
  cachedAt?: string;
}) {
  const timeLabel = cached
    ? "Instant (cached)"
    : executionTime !== undefined
      ? `${(executionTime / 1000).toFixed(2)}s`
      : null;

  return (
    <div className="mt-4 pt-3 border-t border-[#3a4759] flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-400">
      <span className="inline-flex items-center gap-1.5 text-emerald-400/90">
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium">{GEMINI_MODEL_LABEL}</span>
      </span>

      {source && (
        <>
          <span className="text-gray-600 hidden sm:inline">·</span>
          <span>
            <span className="text-gray-500">Source: </span>
            <span className="text-emerald-400 font-medium">{source}</span>
          </span>
        </>
      )}

      {cached && (
        <span className="inline-flex items-center gap-1 text-yellow-400/80">
          <Zap className="w-3 h-3" />
          Cached
          {cachedAt && (
            <span className="text-gray-500">· {new Date(cachedAt).toLocaleTimeString()}</span>
          )}
        </span>
      )}

      {timeLabel && (
        <>
          <span className="text-gray-600 hidden sm:inline">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="w-3 h-3" />
            {timeLabel}
          </span>
        </>
      )}
    </div>
  );
}

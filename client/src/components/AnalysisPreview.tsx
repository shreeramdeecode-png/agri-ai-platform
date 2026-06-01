import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FormatChatContent } from "@/lib/formatChatContent";
import { splitAssistantContent } from "@/lib/chatMessageUtils";
import { GEMINI_MODEL_LABEL } from "@/lib/aiConfig";

const COLLAPSE_CHARS = 320;

export function AnalysisPreview({ text, title = "AI summary" }: { text: string; title?: string }) {
  const [expanded, setExpanded] = useState(false);
  const { body, source } = splitAssistantContent(text);
  const needsCollapse = body.length > COLLAPSE_CHARS;
  const display =
    needsCollapse && !expanded ? body.slice(0, COLLAPSE_CHARS).trim() + "…" : body;

  if (!expanded && needsCollapse) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
        >
          <ChevronDown className="w-3 h-3" />
          Show {title.toLowerCase()}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-[#3a4759] bg-[#1e293b]/80 p-3 md:p-4">
      <p className="text-xs font-medium text-emerald-400/90 mb-2">{title}</p>
      <div
        className={`text-sm text-gray-200 ${expanded ? "max-h-64 overflow-y-auto scrollbar-thin" : ""}`}
      >
        <FormatChatContent content={display} />
      </div>
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
        >
          <ChevronUp className="w-3 h-3" />
          Show less
        </button>
      )}
      <div className="mt-3 pt-2 border-t border-[#3a4759] text-xs text-gray-400 flex flex-wrap gap-x-2">
        <span className="text-emerald-400/80">{GEMINI_MODEL_LABEL}</span>
        {source && (
          <>
            <span className="text-gray-600">·</span>
            <span>
              <span className="text-gray-500">Source: </span>
              <span className="text-emerald-400 font-medium">{source}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

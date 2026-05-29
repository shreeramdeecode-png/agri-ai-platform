import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FormatChatContent } from "@/lib/formatChatContent";
import { splitAssistantContent } from "@/lib/chatMessageUtils";

const COLLAPSE_CHARS = 140;

export function AnalysisPreview({ text, title = "AI summary" }: { text: string; title?: string }) {
  const [expanded, setExpanded] = useState(false);
  const { body } = splitAssistantContent(text);
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
    </div>
  );
}

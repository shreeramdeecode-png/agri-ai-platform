import type { ReactNode } from "react";

function highlightInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={key++} className="text-emerald-300/90 font-medium">
        {m[1]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text);
  return parts.length ? parts : [text];
}

/** Renders assistant text with theme colors instead of markdown bold. */
export function FormatChatContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2 text-[15px] leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }

        if (/^Source:\s*.+$/i.test(trimmed)) {
          return null;
        }

        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex gap-3 items-start pl-0.5">
              <span
                className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                aria-hidden
              />
              <span className="text-gray-100 flex-1 min-w-0">{highlightInline(bulletMatch[1])}</span>
            </div>
          );
        }

        const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={i} className="flex gap-3 items-start pl-0.5">
              <span className="mt-[0.1em] text-emerald-400/90 shrink-0 text-sm font-medium tabular-nums min-w-[1.25rem]">
                {trimmed.match(/^(\d+)\./)?.[1]}.
              </span>
              <span className="text-gray-100 flex-1 min-w-0">{highlightInline(numberedMatch[1])}</span>
            </div>
          );
        }

        if (trimmed.endsWith(":") && trimmed.length < 80) {
          return (
            <p key={i} className="text-emerald-300/90 font-medium mt-2 first:mt-0">
              {trimmed}
            </p>
          );
        }

        return (
          <p key={i} className="text-gray-100">
            {highlightInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

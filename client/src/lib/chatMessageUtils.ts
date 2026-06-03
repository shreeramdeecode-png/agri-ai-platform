/** Split assistant body from trailing Source: line */
export function splitAssistantContent(content: string): {
  body: string;
  source: string | null;
} {
  const lines = content.split("\n");
  let source: string | null = null;
  const bodyLines: string[] = [];

  for (const line of lines) {
    const m = line.trim().match(/^Source:\s*(.+)$/i);
    if (m) {
      source = m[1].trim();
    } else {
      bodyLines.push(line);
    }
  }

  return {
    body: bodyLines.join("\n").replace(/\n+$/, "").trim(),
    source,
  };
}

export function formatGeminiModelLabel(modelId: string): string {
  const id = modelId.replace(/^models\//, "");
  if (id.includes("2.5-flash")) return "Gemini 2.5 Flash";
  if (id.includes("2.0-flash")) return "Gemini 2.0 Flash";
  if (id.includes("1.5-flash")) return "Gemini 1.5 Flash";
  return id
    .replace(/^gemini-/i, "Gemini ")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function uploadsPublicUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const uploadsIdx = normalized.toLowerCase().indexOf("/uploads/");
  if (uploadsIdx >= 0) {
    const relative = normalized.slice(uploadsIdx + "/uploads/".length);
    return `/uploads/${relative.split("/").map(encodeURIComponent).join("/")}`;
  }
  const name = normalized.split("/").pop() || normalized;
  return `/uploads/${encodeURIComponent(name)}`;
}

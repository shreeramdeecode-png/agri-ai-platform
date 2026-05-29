const COMMODITY_ALIASES: Record<string, string[]> = {
  wheat: ["wheat", "wheat flour", "flour", "atta"],
  rice: ["rice", "paddy"],
  maize: ["maize", "corn"],
  lentils: ["lentil", "lentils", "pulse", "pulses"],
  pulse: ["pulse", "pulses", "lentil", "lentils"],
  cotton: ["cotton"],
};

/** True when API commodity name matches the crop the user asked for. */
export function commodityMatches(requestedCrop: string | undefined, apiCrop: string | undefined): boolean {
  if (!requestedCrop?.trim()) return true;
  if (!apiCrop?.trim()) return false;

  const req = requestedCrop.toLowerCase().trim();
  const api = apiCrop.toLowerCase().trim();
  const aliases = COMMODITY_ALIASES[req] ?? [req];

  return aliases.some((alias) => api.includes(alias) || alias.includes(api));
}

export function stripFollowUpQuery(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^Follow-up question\s*\(previous context:[\s\S]*?\):\s*(.+)$/i);
  return match ? match[1].trim() : trimmed;
}

/** Remove markdown bold markers; UI applies color instead. */
export function normalizeAnswerText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

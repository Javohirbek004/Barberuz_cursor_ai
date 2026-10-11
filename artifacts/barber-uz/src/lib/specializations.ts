const ICONS: Record<string, string> = {
  "soch olish": "✂️",
  fade: "✂️",
  klassik: "✂️",
  haircut: "✂️",
  soqol: "🧔",
  "soqol tekislash": "🪒",
  bolalar: "👶",
  kompleks: "💈",
};

function cleanLabel(value: string): string {
  let text = value.trim();
  for (let i = 0; i < 3; i++) {
    const next = text
      .replace(/^\[+|\]+$/g, "")
      .replace(/^["']+|["']+$/g, "")
      .trim();
    if (next === text) break;
    text = next;
  }
  return text;
}

/** Turns stored JSON or a comma list into plain specialty names. */
export function parseSpecializations(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.flatMap((item) => parseSpecializations(item));
  if (!raw?.trim()) return [];

  const text = raw.trim();
  let parts: string[] = [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) parts = parsed.map((item) => String(item));
    } catch {
      parts = text.split(",");
    }
  }
  if (parts.length === 0) parts = text.split(",");

  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of parts) {
    const label = cleanLabel(part);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function specialtyIcon(label: string): string | null {
  return ICONS[label.trim().toLowerCase()] ?? null;
}

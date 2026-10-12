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

export const DEFAULT_SPECIALTY_EMOJI = "💈";

export const SPECIALTY_QUICK_EMOJIS = ["💈", "✂️", "🪒", "🔥", "👶", "🎨", "⭐"] as const;

/** Leading emoji (including ZWJ sequences and variation selectors). */
const LEADING_EMOJI =
  /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u20E3)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\u20E3)?)*)/u;

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

function fromStoredItem(item: unknown): string {
  if (item == null) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object") {
    const rec = item as { name?: unknown; emoji?: unknown; text?: unknown };
    const name = String(rec.name ?? rec.text ?? "").trim();
    const emoji = String(rec.emoji ?? "").trim();
    if (emoji && name) return `${emoji} ${name}`;
    return name || emoji;
  }
  return String(item);
}

/** Turns stored JSON or a comma list into specialty labels (emoji + text when present). */
export function parseSpecializations(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.flatMap((item) => parseSpecializations(fromStoredItem(item)));
  if (!raw?.trim()) return [];

  const text = raw.trim();
  let parts: string[] = [];
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) parts = parsed.map((item) => fromStoredItem(item));
    } catch {
      parts = text.split(",");
    }
  }
  if (parts.length === 0) parts = text.split(",");

  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of parts) {
    const label = cleanLabel(part);
    const key = stripLeadingEmoji(label).toLowerCase() || label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function startsWithEmoji(label: string): boolean {
  return LEADING_EMOJI.test(label.trim());
}

export function leadingEmoji(label: string): string | null {
  const match = label.trim().match(LEADING_EMOJI);
  return match?.[0] ?? null;
}

export function stripLeadingEmoji(label: string): string {
  return label.trim().replace(LEADING_EMOJI, "").replace(/^[\s\-–—:]+/, "").trim();
}

export function formatSpecialtyTag(raw: string, selectedEmoji?: string | null): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (startsWithEmoji(trimmed)) {
    const emojiMatch = trimmed.match(LEADING_EMOJI);
    const emoji = emojiMatch?.[0] ?? DEFAULT_SPECIALTY_EMOJI;
    const rest = stripLeadingEmoji(trimmed);
    return rest ? `${emoji} ${rest}` : emoji;
  }
  const icon =
    selectedEmoji && startsWithEmoji(selectedEmoji)
      ? (selectedEmoji.match(LEADING_EMOJI)?.[0] ?? selectedEmoji)
      : DEFAULT_SPECIALTY_EMOJI;
  return `${icon} ${trimmed}`;
}

export function specialtyIcon(label: string): string | null {
  if (startsWithEmoji(label)) return null;
  return ICONS[stripLeadingEmoji(label).toLowerCase()] ?? ICONS[label.trim().toLowerCase()] ?? null;
}

/** Icon used when rendering a tag that was stored without an emoji. */
export function specialtyDisplayIcon(label: string): string | null {
  if (startsWithEmoji(label)) return null;
  return specialtyIcon(label) ?? DEFAULT_SPECIALTY_EMOJI;
}

export type NameProblem = "empty" | "short" | "long" | "digits" | "symbols" | "ok";

const LETTER = /[a-zA-Zа-яА-ЯёЁўқғҳЎҚҒҲ]/;
const ALLOWED = /^[a-zA-Z0-9а-яА-ЯёЁўқғҳЎҚҒҲ _'’‘]+$/;
const SEPARATOR = /[_ '’‘]/;

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/** Page address: apostrophes drop, spaces become _, Cyrillic becomes Latin. */
export function signupSlug(raw: string): string {
  let out = "";
  for (const ch of raw.trim().toLowerCase()) {
    out += CYRILLIC[ch] ?? ch;
  }
  return out
    .replace(/['’‘`]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function inspectSignupName(raw: string): NameProblem {
  if (!raw.trim()) return "empty";
  if (raw.length < 3) return "short";
  if (raw.length > 25) return "long";
  if (/^\d+$/.test(raw)) return "digits";
  if (!LETTER.test(raw)) return "symbols";
  if (!ALLOWED.test(raw)) return "symbols";
  if (SEPARATOR.test(raw[0]) || SEPARATOR.test(raw[raw.length - 1])) return "symbols";
  if (/[_ '’‘]{2,}/.test(raw)) return "symbols";
  if (/^[.\-]|[.\-]$/.test(raw)) return "symbols";
  return "ok";
}

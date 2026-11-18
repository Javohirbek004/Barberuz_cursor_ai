export type NameProblem = "empty" | "short" | "long" | "digits" | "symbols" | "ok";

const LETTER = /[a-zA-Zа-яА-ЯёЁўқғҳЎҚҒҲ]/;
const ALLOWED = /^[a-zA-Z0-9а-яА-ЯёЁўқғҳЎҚҒҲ _'’‘]+$/;
const SEPARATOR = /[_ '’‘]/;

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

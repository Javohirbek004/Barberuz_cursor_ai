import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** Digits only: "+998 (90) 123-45-67" -> "998901234567". */
export function phoneDigits(raw: string | null | undefined): string {
  return (raw || "").replace(/\D/g, "");
}

/**
 * One standard way to store a phone number: "+998XXXXXXXXX" for Uzbek numbers,
 * "+<digits>" for foreign ones. Returns null when the text is not a usable number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  let digits = phoneDigits(raw);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return null;

  if (digits.startsWith("998")) return digits.length === 12 ? `+${digits}` : null;
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 10 && (digits.startsWith("8") || digits.startsWith("0"))) {
    return `+998${digits.slice(1)}`;
  }
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** The last nine digits identify a person whatever the spelling of the number. */
export function phoneKey(raw: string | null | undefined): string | null {
  const digits = phoneDigits(raw);
  return digits.length >= 9 ? digits.slice(-9) : null;
}

/** SQL: the stored phone with every non-digit removed. */
export function sqlPhoneDigits(column: AnyPgColumn): SQL {
  return sql`regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g')`;
}

/** SQL: stored phone belongs to the person with this key (last nine digits). */
export function sqlPhoneKeyMatches(column: AnyPgColumn, key: string): SQL {
  return sql`right(${sqlPhoneDigits(column)}, 9) = ${key}`;
}

/** Digits after the Uzbekistan country code, at most 9. */
export function localPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return (digits.startsWith("998") ? digits.slice(3) : digits).slice(0, 9);
}

/** Empty (or only +998) is allowed. A started number must be complete. */
export function phoneReadyOrEmpty(phone: string): boolean {
  const local = localPhoneDigits(phone);
  return local.length === 0 || local.length >= 9;
}

export type ClientLang = "uz" | "ru";

export function asClientLang(value: unknown): ClientLang {
  return value === "ru" ? "ru" : "uz";
}

export function ct(lang: unknown, uz: string, ru: string): string {
  return asClientLang(lang) === "ru" ? ru : uz;
}

export const MENU_BOOKINGS_UZ = "📅 Mening bronlarim";
export const MENU_BOOKINGS_RU = "📅 Мои записи";
export const MENU_REBOOK_UZ = "🔄 Qayta bron qilish";
export const MENU_REBOOK_RU = "🔄 Записаться снова";
export const MENU_REBOOK_OLD = "✂️ Qayta bron";
export const MENU_CONTACT_UZ = "📞 Aloqa";
export const MENU_CONTACT_RU = "📞 Связь";
export const PHONE_BUTTON_UZ = "📞 Telefon raqamni yuborish";
export const PHONE_BUTTON_RU = "📞 Отправить номер";
export const PHONE_BUTTON_ALT_UZ = "📱 Telefon raqamni yuborish";
export const PHONE_BUTTON_ALT_RU = "📱 Отправить номер";

export function menuKind(text: string): "bookings" | "rebook" | "contact" | null {
  if (text === MENU_BOOKINGS_UZ || text === MENU_BOOKINGS_RU) return "bookings";
  if (text === MENU_REBOOK_UZ || text === MENU_REBOOK_RU || text === MENU_REBOOK_OLD) return "rebook";
  if (text === MENU_CONTACT_UZ || text === MENU_CONTACT_RU) return "contact";
  return null;
}

export function serviceLabel(
  lang: unknown,
  services: Array<{ name?: string | null; nameRu?: string | null }> | null | undefined,
  fallback = "",
): string {
  const rows = services || [];
  const names = rows
    .map((row) => {
      const ru = row.nameRu?.trim();
      const name = row.name?.trim();
      return asClientLang(lang) === "ru" && ru ? ru : name;
    })
    .filter((name): name is string => !!name);
  return names.join(", ") || fallback;
}

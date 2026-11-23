import { deviceOutsideTashkentZone, tashkentClockLabel } from "@/lib/schedule";
import { useTranslation } from "@/i18n/LanguageContext";
import { pick } from "@/i18n/pick";

/**
 * Bookings follow the shop's clock (Tashkent). If the device clock is set to another
 * timezone, show the shop time so "Bugun" and the hidden past slots are easy to understand.
 */
export function ShopTimeHint() {
  const { lang } = useTranslation();
  if (!deviceOutsideTashkentZone()) return null;
  const clock = tashkentClockLabel();
  return (
    <p
      data-testid="shop-time-hint"
      className="mb-3 text-center text-[11px] text-muted-foreground/70"
    >
      {pick(lang, `🕒 Toshkent vaqti: ${clock}`, `🕒 Время Ташкента: ${clock}`)}
    </p>
  );
}

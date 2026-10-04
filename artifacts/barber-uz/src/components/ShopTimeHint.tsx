import { deviceOutsideTashkentZone, tashkentClockLabel } from "@/lib/schedule";

/**
 * Bookings follow the shop's clock (Tashkent). If the device clock is set to another
 * timezone, show the shop time so "Bugun" and the hidden past slots are easy to understand.
 */
export function ShopTimeHint() {
  if (!deviceOutsideTashkentZone()) return null;
  return (
    <p
      data-testid="shop-time-hint"
      className="mb-3 text-center text-[11px] text-muted-foreground/70"
    >
      🕒 Toshkent vaqti: {tashkentClockLabel()}
    </p>
  );
}

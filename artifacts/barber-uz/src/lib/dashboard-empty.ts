export type DashboardEmptyPhase = "before" | "during" | "after";

export interface DashboardEmptyCopy {
  phase: DashboardEmptyPhase;
  title: string;
  subtitle: string;
  showActions: boolean;
}

/**
 * Empty dashboard greeting for a day with no active or upcoming bookings.
 * A closed weekday has no open window, so it uses the after-hours greeting.
 */
export function dashboardEmptyCopy(
  nowMins: number,
  shift: { enabled: boolean; startMins: number; endMins: number },
): DashboardEmptyCopy {
  const before = shift.enabled && nowMins < shift.startMins;
  const during = shift.enabled && nowMins >= shift.startMins && nowMins < shift.endMins;

  if (before) {
    return {
      phase: "before",
      title: "Xayrli tong! Bugun hali ish vaqti boshlanmadi",
      subtitle: "Mijozlaringizga bron havolasini yuboring yoki qo'lda bron qo'shing.",
      showActions: true,
    };
  }

  if (during) {
    const hello = Math.floor(nowMins / 60) >= 18 ? "Xayrli kech!" : "Xayrli kun!";
    return {
      phase: "during",
      title: `${hello} Ayni paytda kutilayotgan bronlar mavjud emas`,
      subtitle:
        "Ish vaqtingiz davom etmoqda. Yangi mijozlarni jalb qilish uchun havolani ulashing yoki kelgan mijozni qo'lda qo'shing.",
      showActions: true,
    };
  }

  return {
    phase: "after",
    title: "Xayrli kech! Bugungi ish kuni yakunlandi",
    subtitle: "Ertangi kun uchun bo'sh joylar va rejalarni kalendardan tekshirishingiz mumkin.",
    showActions: false,
  };
}

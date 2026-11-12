export type DashboardEmptyPhase = "before" | "during" | "after";

export interface DashboardEmptyCopy {
  phase: DashboardEmptyPhase;
  title: string;
  subtitle: string;
  showActions: boolean;
}

/**
 * Empty dashboard greeting for a day with no active or upcoming bookings.
 * A day the barber marked off has its own greeting.
 */
export function dashboardEmptyCopy(
  nowMins: number,
  shift: { enabled: boolean; startMins: number; endMins: number },
  lang = "uz",
): DashboardEmptyCopy {
  const ru = lang === "ru";
  if (!shift.enabled) {
    return {
      phase: "after",
      title: ru ? "Хорошего дня! Сегодня у вас выходной." : "Xayrli kun! Bugun sizda dam olish kuni.",
      subtitle: ru
        ? "Планы на завтра и свободные окна можно посмотреть в календаре."
        : "Ertangi kun rejalari va bo'sh joylarni kalendardan ko'rishingiz mumkin.",
      showActions: false,
    };
  }

  const before = shift.enabled && nowMins < shift.startMins;
  const during = shift.enabled && nowMins >= shift.startMins && nowMins < shift.endMins;

  if (before) {
    return {
      phase: "before",
      title: ru ? "Доброе утро! Рабочее время ещё не началось" : "Xayrli tong! Bugun hali ish vaqti boshlanmadi",
      subtitle: ru
        ? "Отправьте клиентам ссылку на запись или добавьте запись вручную."
        : "Mijozlaringizga bron havolasini yuboring yoki qo'lda bron qo'shing.",
      showActions: true,
    };
  }

  if (during) {
    const hello = ru
      ? (Math.floor(nowMins / 60) >= 18 ? "Добрый вечер!" : "Добрый день!")
      : (Math.floor(nowMins / 60) >= 18 ? "Xayrli kech!" : "Xayrli kun!");
    return {
      phase: "during",
      title: ru
        ? `${hello} Сейчас нет ожидаемых записей`
        : `${hello} Ayni paytda kutilayotgan bronlar mavjud emas`,
      subtitle: ru
        ? "Рабочий день идёт. Поделитесь ссылкой или добавьте пришедшего клиента вручную."
        : "Ish vaqtingiz davom etmoqda. Yangi mijozlarni jalb qilish uchun havolani ulashing yoki kelgan mijozni qo'lda qo'shing.",
      showActions: true,
    };
  }

  return {
    phase: "after",
    title: ru ? "Добрый вечер! Рабочий день закончился" : "Xayrli kech! Bugungi ish kuni yakunlandi",
    subtitle: ru
      ? "Свободные окна и планы на завтра можно проверить в календаре."
      : "Ertangi kun uchun bo'sh joylar va rejalarni kalendardan tekshirishingiz mumkin.",
    showActions: false,
  };
}

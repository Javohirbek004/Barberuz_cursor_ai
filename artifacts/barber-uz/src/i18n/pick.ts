export function pick(lang: string, uz: string, ru: string): string {
  return lang === "ru" ? ru : uz;
}

export function moneyLabel(lang: string, amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const grouped = n.toLocaleString(lang === "ru" ? "ru-RU" : "uz-UZ");
  return `${grouped} ${pick(lang, "so'm", "сум")}`;
}

export function countLabel(lang: string, amount: number): string {
  return `${amount} ${pick(lang, "ta", "шт.")}`;
}

export function monthNames(lang: string): string[] {
  return lang === "ru"
    ? ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
    : ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
}

export function weekdayNames(lang: string): string[] {
  return lang === "ru"
    ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    : ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
}

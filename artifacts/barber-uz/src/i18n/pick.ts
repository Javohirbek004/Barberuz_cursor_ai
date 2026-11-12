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

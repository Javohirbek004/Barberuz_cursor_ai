/**
 * Client Telegram receipts, reminders, confirm / cancel, and auto-cancel.
 * Times are Asia/Tashkent (UTC+5). Real bookings are only changed by the
 * callback handlers and the reminder cycle — the /eslatma preview does not.
 */

import { db, bookingsTable, bookingSessionsTable, clientsTable, usersTable } from "@workspace/db";
import { syncClientMetrics } from "./client-metrics";
import { getTelegramBotToken, publicAppUrl } from "./telegram-token";
import { barberEntryMarkup } from "./barber-entry-keyboard";
import { bindBarberTelegramChat } from "./barber-telegram";
import {
  asClientLang,
  ct,
  serviceLabel,
  MENU_BOOKINGS_RU,
  MENU_BOOKINGS_UZ,
  MENU_CONTACT_RU,
  MENU_CONTACT_UZ,
  MENU_REBOOK_RU,
  MENU_REBOOK_UZ,
  type ClientLang,
} from "./client-lang";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

const TELEGRAM_API = "https://api.telegram.org";
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const OPEN_STATUSES = ["pending", "confirmed"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const RU_MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

interface BarberCard {
  id: string;
  name: string;
  brandName: string | null;
  address: string | null;
  mapLink: string | null;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  botPhone?: string | null;
  phoneVisible: boolean;
  username: string;
  telegramId: string | null;
  eveningConfirm?: boolean;
  quickReminder?: boolean;
  autoCancel?: boolean;
  notifyCancel?: boolean;
  cancelLimit?: number;
}

interface BookingCard {
  id: string;
  barberId: string;
  clientId: string | null;
  clientName: string;
  serviceName: string | null;
  price: string;
  date: string;
  startTime: string;
  status: string;
  clientConfirmed: boolean;
  clientTelegramId: string | null;
  clientLang?: string | null;
  reminded24h: boolean;
  reminded1h: boolean;
  remindedFollowup: boolean;
  createdAt: Date;
  deletedAt: Date | null;
}

function token(): string {
  return getTelegramBotToken();
}

/** Client rebook link: the barber's booking page, not the app home. */
export function rebookUrl(username: string | null | undefined): string {
  const site = publicAppUrl();
  const slug = (username || "").trim();
  if (!slug) return site;
  return `${site}/${encodeURIComponent(slug)}?bron=1`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lines(...parts: Array<string | null | undefined>): string {
  return parts.filter((line): line is string => line != null).join("\n");
}

function digits(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = digits(a);
  const db = digits(b);
  if (da.length < 9 || db.length < 9) return false;
  return da === db || da.slice(-9) === db.slice(-9);
}

function formatPhone(raw: string | null | undefined): string {
  const d = digits(raw);
  if (d.length === 12 && d.startsWith("998")) {
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  }
  return (raw || "").trim();
}

function uzDate(iso: string, lang: ClientLang = "uz"): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = lang === "ru" ? RU_MONTHS : MONTHS;
  return lang === "ru" ? `${d} ${months[(m || 1) - 1]}` : `${d}-${months[(m || 1) - 1]}`;
}

function tashkentNow(now = Date.now()): { hour: number; minute: number; date: string } {
  const shifted = new Date(now + TASHKENT_OFFSET_MS);
  const date = shifted.toISOString().slice(0, 10);
  return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), date };
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function appointmentMs(date: string, time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const stamp = `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:00`;
  return new Date(stamp).getTime();
}

function safeMap(url: string | null | undefined): string {
  const value = (url || "").trim();
  if (!/^https?:\/\//i.test(value)) return "";
  return value;
}

function resolveMapUrl(barber: {
  mapLink?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}): string {
  const link = safeMap(barber.mapLink);
  if (link) return link;
  const lat = Number((barber.latitude || "").trim());
  const lng = Number((barber.longitude || "").trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return "";
  if (lat === 0 && lng === 0) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function addressLine(mapUrl: string, address: string, lang: ClientLang = "uz"): string | null {
  const link = safeMap(mapUrl);
  const place = address.trim();
  const label = ct(lang, "Manzil", "Адрес");
  const mapWord = ct(lang, "Xaritadan ko'rish", "Открыть карту");
  if (link && place) {
    return `📍 ${label}: <a href="${esc(link)}">🗺️ ${mapWord}</a> — ${esc(place)}`;
  }
  if (link) return `📍 ${label}: <a href="${esc(link)}">🗺️ ${mapWord}</a>`;
  if (place) return `📍 ${label}: ${esc(place)}`;
  return null;
}

function salonName(barber: BarberCard): string {
  return barber.brandName?.trim() || barber.name?.trim() || "Barber.uz";
}

function contactLine(barber: BarberCard, lang: ClientLang = "uz"): string | null {
  if (!barber.phoneVisible || !barber.phone?.trim()) return null;
  return `📞 ${ct(lang, "Bogʻlanish", "Связь")}: ${esc(formatPhone(barber.phone))}`;
}

export const CLIENT_CANCEL_LIMITS = [30, 60, 120, 180] as const;

export function normalizeCancelLimit(value: unknown): number {
  const n = Number(value);
  return (CLIENT_CANCEL_LIMITS as readonly number[]).includes(n) ? n : 60;
}

function limitPhrase(minutes: number, lang: ClientLang = "uz"): string {
  if (lang === "ru") {
    if (minutes <= 30) return "меньше 30 минут";
    if (minutes <= 60) return "меньше 1 часа";
    if (minutes <= 120) return "меньше 2 часов";
    return "меньше 3 часов";
  }
  if (minutes <= 30) return "30 daqiqadan kam";
  if (minutes <= 60) return "1 soatdan kam";
  if (minutes <= 120) return "2 soatdan kam";
  return "3 soatdan kam";
}

export function clientCancelKeyboard(bookingId: string, lang: ClientLang = "uz") {
  return {
    inline_keyboard: [[
      { text: ct(lang, "❌ Bronni bekor qilish", "❌ Отменить запись"), callback_data: `cancel_${bookingId}` },
    ]],
  };
}

export function clientMenuKeyboard(lang: ClientLang = "uz") {
  return {
    keyboard: [
      [{ text: lang === "ru" ? MENU_BOOKINGS_RU : MENU_BOOKINGS_UZ }],
      [
        { text: lang === "ru" ? MENU_REBOOK_RU : MENU_REBOOK_UZ },
        { text: lang === "ru" ? MENU_CONTACT_RU : MENU_CONTACT_UZ },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function mapLinkLine(barber: BarberCard, lang: ClientLang = "uz"): string | null {
  const link = resolveMapUrl(barber);
  if (!link) return null;
  return `📍 ${ct(lang, "Manzil", "Адрес")}: <a href="${esc(link)}">${ct(lang, "Xaritadan ko'rish", "Открыть карту")}</a>`;
}

function phoneLine(barber: BarberCard, lang: ClientLang = "uz"): string | null {
  if (barber.phoneVisible === false || !barber.phone?.trim()) return null;
  return `📞 ${ct(lang, "Aloqa", "Связь")}: ${esc(formatPhone(barber.phone))}`;
}

function botNote(lang: ClientLang = "uz"): string {
  return lines(
    ct(lang, "🤖 <b>Bot haqida eslatma:</b>", "🤖 <b>О боте:</b>"),
    ct(lang, "Ushbu bot sizning shaxsiy yordamchingiz:", "Этот бот — ваш помощник:"),
    ct(lang, "• Navbatingizga oz qolganda eslatma yuboradi", "• Напомнит, когда до записи останется немного"),
    ct(lang, "• Istalgan vaqtda qayta bron qilishga yordam beradi", "• Поможет записаться снова в любое время"),
    "",
    ct(lang, "Chatni o'chirmang, qulaylikdan foydalaning!", "Не удаляйте чат — так удобнее."),
  );
}

function moneyAmount(price: string | number | null | undefined): string {
  const n = Number(price ?? 0);
  return Number.isFinite(n) ? Math.round(n).toLocaleString("ru-RU") : "0";
}

function arrivalNote(minutesLeft: number, lang: ClientLang = "uz"): string {
  if (minutesLeft >= 60) {
    return lines(
      ct(lang, "Iltimos, broningiz vaqtidan 5-10 daqiqa ertaroq keling.", "Пожалуйста, приходите на 5–10 минут раньше."),
      "",
      ct(
        lang,
        "ℹ️ <b>Eslatma:</b> Bronni bekor qilish uchun cheklov vaqti mavjud. Cheklov vaqti o'tgach, faqat usta bilan bog'lanib bronni bekor qilishingiz mumkin.",
        "ℹ️ <b>Напоминание:</b> отменить запись можно только до определённого времени. После этого — только через мастера.",
      ),
    );
  }
  if (minutesLeft >= 20) {
    return lines(
      ct(
        lang,
        "⏳ <b>Eslatma:</b> Uchrashuv vaqtiga oz qoldi (1 soatdan kam vaqt qoldi). Iltimos, tayyorgarlikni ko'ring.",
        "⏳ <b>Напоминание:</b> до встречи осталось меньше часа. Пожалуйста, соберитесь.",
      ),
      "",
      ct(
        lang,
        "⚠️ <b>Eslatma:</b> Bu bron uchun bekor qilish vaqti tugagan. O'zgarishlar bo'lsa, ustaga to'g'ridan-to'g'ri qo'ng'iroq qiling.",
        "⚠️ <b>Напоминание:</b> время отмены этой записи прошло. Если планы изменились, позвоните мастеру.",
      ),
    );
  }
  return lines(
    ct(
      lang,
      "🚨 <b>Diqqat!</b> Uchrashuv vaqtiga juda oz qoldi! Iltimos, darhol yo'lga chiqing yoki tezroq yetib boring.",
      "🚨 <b>Внимание!</b> До встречи осталось совсем мало времени. Выходите сразу.",
    ),
    "",
    ct(
      lang,
      "⚠️ <b>Eslatma:</b> Bu bronni endi bekor qilib bo'lmaydi. Har qanday o'zgarish bo'yicha ustaga zudlik bilan qo'ng'iroq qiling.",
      "⚠️ <b>Напоминание:</b> эту запись уже нельзя отменить. По любым изменениям сразу звоните мастеру.",
    ),
  );
}

export function clientReceiptMessage(input: {
  barber: BarberCard;
  clientName: string;
  service: string;
  price: string | number | null | undefined;
  date: string;
  time: string;
  minutesLeft: number;
  bookingId?: string | null;
  lang?: ClientLang;
}): {
  text: string;
  reply_markup: ReturnType<typeof clientMenuKeyboard>;
  cancelMarkup: ReturnType<typeof clientCancelKeyboard> | null;
} {
  const lang = asClientLang(input.lang);
  const limit = normalizeCancelLimit(input.barber.cancelLimit);
  const canCancel = input.minutesLeft > limit && !!input.bookingId;
  const text = lines(
    ct(lang, `🥳 <b>Broningiz qabul qilindi, ${esc(input.clientName)}!</b>`, `🥳 <b>Запись принята, ${esc(input.clientName)}!</b>`),
    "",
    `👤 ${ct(lang, "Usta", "Мастер")}: ${esc(salonName(input.barber))}`,
    `✂️ ${ct(lang, "Xizmat", "Услуга")}: ${esc(input.service)}`,
    `💵 ${ct(lang, "Narx", "Цена")}: ${esc(moneyAmount(input.price))} ${ct(lang, "so'm", "сум")}`,
    `📅 ${ct(lang, "Sana", "Дата")}: ${esc(uzDate(input.date, lang))}`,
    `⏰ ${ct(lang, "Vaqt", "Время")}: ${esc(input.time)}`,
    phoneLine(input.barber, lang),
    mapLinkLine(input.barber, lang),
    "",
    arrivalNote(input.minutesLeft, lang),
    "",
    botNote(lang),
  );
  return {
    text,
    reply_markup: clientMenuKeyboard(lang),
    cancelMarkup: canCancel ? clientCancelKeyboard(input.bookingId!, lang) : null,
  };
}

export function reminder24Message(input: {
  barber: BarberCard;
  clientName: string;
  service: string;
  time: string;
  bookingId: string;
  lang?: ClientLang;
}): { text: string; reply_markup: ReturnType<typeof clientCancelKeyboard> } {
  const lang = asClientLang(input.lang);
  return {
    text: lines(
      ct(lang, `⏰ <b>Ertaga navbatingiz bor, ${esc(input.clientName)}!</b>`, `⏰ <b>Завтра у вас запись, ${esc(input.clientName)}!</b>`),
      "",
      `👤 ${ct(lang, "Usta", "Мастер")}: ${esc(salonName(input.barber))}`,
      `✂️ ${ct(lang, "Xizmat", "Услуга")}: ${esc(input.service)}`,
      ct(lang, `⏰ Vaqt: Ertaga ${esc(input.time)} da`, `⏰ Время: завтра в ${esc(input.time)}`),
      mapLinkLine(input.barber, lang),
      "",
      ct(lang, "💡 Iltimos, belgilangan vaqtda keling.", "💡 Пожалуйста, приходите вовремя."),
    ),
    reply_markup: clientCancelKeyboard(input.bookingId, lang),
  };
}

export function reminder1hMessage(input: {
  barber: BarberCard;
  clientName: string;
  service: string;
  time: string;
  bookingId: string;
  lang?: ClientLang;
}): { text: string; reply_markup?: ReturnType<typeof clientCancelKeyboard> } {
  const lang = asClientLang(input.lang);
  const limit = normalizeCancelLimit(input.barber.cancelLimit);
  const text = lines(
    ct(lang, `🚨 <b>Diqqat, ${esc(input.clientName)}! 1 soatdan keyin navbatingiz bor!</b>`, `🚨 <b>Внимание, ${esc(input.clientName)}! Через 1 час у вас запись!</b>`),
    "",
    `👤 ${ct(lang, "Usta", "Мастер")}: ${esc(salonName(input.barber))}`,
    `✂️ ${ct(lang, "Xizmat", "Услуга")}: ${esc(input.service)}`,
    ct(lang, `⏰ Vaqt: ${esc(input.time)} (1 soat qoldi)`, `⏰ Время: ${esc(input.time)} (остался 1 час)`),
    mapLinkLine(input.barber, lang),
    "",
    ct(lang, "💡 Iltimos, belgilangan vaqtda keling. Agarda kechikishingiz mumkin bo‘lsa yoki qandaydir sababga ko‘ra kela olmasangiz, darhol barber bilan aloqaga chiqing!", "💡 Пожалуйста, приходите вовремя. Если задержитесь или не сможете прийти, сразу свяжитесь с мастером."),
  );
  return limit === 30
    ? { text, reply_markup: clientCancelKeyboard(input.bookingId, lang) }
    : { text };
}

export function receiptText(barber: BarberCard, service: string, date: string, time: string): string {
  return lines(
    "🎉 <b>Broningiz qabul qilindi!</b>",
    "",
    `💈 Salon: ${esc(salonName(barber))}`,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana: ${esc(uzDate(date))}`,
    `⏰ Vaqt: ${esc(time)}`,
    addressLine(resolveMapUrl(barber), barber.address || ""),
    "",
    "⚠️ Iltimos, kelishingizni tasdiqlang.",
  );
}

export function publicConfirmedReceiptText(barber: BarberCard, service: string, date: string, time: string): string {
  return lines(
    "✅ <b>Broningiz muvaffaqiyatli tasdiqlandi!</b>",
    "",
    `💈 Usta: ${esc(salonName(barber))}`,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana: ${esc(uzDate(date))}`,
    `⏰ Vaqt: ${esc(time)}`,
    addressLine(resolveMapUrl(barber), barber.address || ""),
    "",
    "⏰ <b>Eslatmalar</b> (Telegram orqali):",
    "• 1 kun oldin",
    "• Vaqt yaqinlashganda",
    "• 1 soat oldin",
    "",
    "Kutilgan vaqtda kutamiz! 💈",
  );
}

export function reminder24Text(barber: BarberCard, service: string, date: string, time: string): string {
  return lines(
    "🚨 <b>Eslatma! Ertaga navbatingiz bor</b>",
    "",
    `💈 Salon: ${esc(salonName(barber))}`,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana: Ertaga (${esc(uzDate(date))})`,
    `⏰ Vaqt: ${esc(time)}`,
    addressLine(resolveMapUrl(barber), barber.address || ""),
    "",
    "Kelishingizni tasdiqlaysizmi?",
  );
}

export function followupText(): string {
  return [
    "⏳ Sizning navbatingizga oz vaqt qoldi.",
    "Iltimos, kelishingizni tasdiqlang.",
  ].join("\n");
}

export function reminder1hText(barber: BarberCard, time: string): string {
  return lines(
    "⏰ <b>1 soatdan keyin uchrashamiz!</b>",
    "",
    `Soat ${esc(time)} da sizni ${esc(salonName(barber))} salonida kutib qolamiz ✂️`,
    "",
    addressLine(resolveMapUrl(barber), barber.address || ""),
    contactLine(barber),
    "",
    "Xush kayfiyat bilan kutamiz! 💈",
    "Iltimos oʻz vaqtida keling!",
  );
}

function confirmedText(lang: ClientLang = "uz"): string {
  return [
    ct(lang, "✨ <b>Ajoyib! Navbatingiz tasdiqlandi.</b>", "✨ <b>Отлично! Запись подтверждена.</b>"),
    "",
    ct(lang, "Sizni belgilangan vaqtda kutapmiz.", "Ждём вас в назначенное время."),
    ct(lang, "Iltimos belgilangan vaqtdan 5 daqiqa oldin keling!", "Пожалуйста, приходите за 5 минут."),
  ].join("\n");
}

function tooLateText(barber: BarberCard, limit = normalizeCancelLimit(barber.cancelLimit), lang: ClientLang = "uz"): string {
  const phone = barber.phone?.trim()
    ? `\n📞 ${ct(lang, "Telefon", "Телефон")}: ${esc(formatPhone(barber.phone))}`
    : "";
  return [
    ct(lang, "🚫 <b>Bekor qilish vaqti o'tdi!</b>", "🚫 <b>Время отмены прошло!</b>"),
    "",
    ct(
      lang,
      `Navbatga ${limitPhrase(limit)} vaqt qolgani sababli bot orqali bekor qilib bo'lmaydi.`,
      `До записи осталось ${limitPhrase(limit, lang)}, поэтому через бот отменить нельзя.`,
    ),
    ct(lang, `Iltimos, usta bilan bevosita bog'laning:${phone}`, `Свяжитесь с мастером напрямую:${phone}`),
  ].join("\n");
}

export async function handleClientCancelNo(chatId: number, messageId?: number, lang: ClientLang = "uz"): Promise<void> {
  await editOrSend(String(chatId), messageId, ct(lang, "Bron saqlanib qoldi.", "Запись сохранена."), {
    reply_markup: { inline_keyboard: [] },
  });
}

function cancelledText(lang: ClientLang = "uz"): string {
  return [
    ct(lang, "🗑️ <b>Navbatingiz bekor qilindi.</b>", "🗑️ <b>Запись отменена.</b>"),
    "",
    ct(lang, "Boshqa qulay vaqtda koʻrishguncha! Qayta bron qilish uchun quyidagi tugmani bosing 👇", "До встречи в другое удобное время. Чтобы записаться снова, нажмите кнопку 👇"),
  ].join("\n");
}

function barberCancelledText(barber: BarberCard, service: string, date: string, time: string, lang: ClientLang = "uz"): string {
  return lines(
    ct(lang, "🗑️ <b>Navbatingiz bekor qilindi</b>", "🗑️ <b>Ваша запись отменена</b>"),
    "",
    `💈 ${ct(lang, "Salon", "Салон")}: ${esc(salonName(barber))}`,
    `✂️ ${ct(lang, "Xizmat", "Услуга")}: ${esc(service)}`,
    `🗓️ ${ct(lang, "Sana", "Дата")}: ${esc(uzDate(date, lang))}`,
    `⏰ ${ct(lang, "Vaqt", "Время")}: ${esc(time)}`,
    "",
    ct(lang, "Noqulaylik uchun uzr so'raymiz. Qulay boshqa vaqtni tanlash uchun quyidagi tugmani bosing 👇", "Извините за неудобство. Выберите другое удобное время по кнопке ниже 👇"),
    contactLine(barber, lang),
  );
}

function barberRescheduledText(
  barber: BarberCard,
  service: string,
  from: { date: string; time: string },
  to: { date: string; time: string },
  lang: ClientLang = "uz",
): string {
  return lines(
    ct(lang, "🔄 <b>Navbatingiz vaqti o'zgartirildi</b>", "🔄 <b>Время записи изменено</b>"),
    "",
    `💈 ${ct(lang, "Salon", "Салон")}: ${esc(salonName(barber))}`,
    `✂️ ${ct(lang, "Xizmat", "Услуга")}: ${esc(service)}`,
    `❌ ${ct(lang, "Avvalgi vaqt", "Прежнее время")}: ${esc(uzDate(from.date, lang))}, ${esc(from.time)}`,
    `✅ ${ct(lang, "Yangi vaqt", "Новое время")}: ${esc(uzDate(to.date, lang))}, ${esc(to.time)}`,
    addressLine(resolveMapUrl(barber), barber.address || "", lang),
    contactLine(barber, lang),
  );
}

function clientCancelledBarberText(clientName: string, phone: string | null, service: string, date: string, time: string): string {
  return lines(
    "⚠️ <b>Bron bekor qilindi!</b>",
    "",
    `👤 Mijoz: ${esc(clientName)}`,
    phone ? `📞 Telefon: ${esc(formatPhone(phone))}` : null,
    `✂️ Xizmat: ${esc(service)}`,
    `🗓️ Sana va vaqt: ${esc(uzDate(date))}, ${esc(time)}`,
    "",
    "Mijoz botdan bekor qildi. Bu vaqt kalendaringizda bo'shatildi.",
  );
}

async function telegram(method: string, body: Record<string, unknown>): Promise<boolean> {
  const key = token();
  if (!key) return false;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${key}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json() as { ok?: boolean };
    if (!json.ok) {
      console.error(`[ClientNotify] ${method} failed`, JSON.stringify(json));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[ClientNotify] ${method} error`, err);
    return false;
  }
}

async function sendToBarber(chatId: string, text: string): Promise<boolean> {
  let extra: Record<string, unknown> = {};
  try {
    const entryMarkup = await barberEntryMarkup(chatId);
    if (entryMarkup) extra = { reply_markup: entryMarkup };
  } catch { /* the cancel note must still go out */ }
  if (await send(chatId, text, extra)) return true;
  if (extra.reply_markup) return send(chatId, text);
  return false;
}

async function send(chatId: string, text: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

async function editOrSend(
  chatId: string,
  messageId: number | undefined,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (messageId) {
    const edited = await telegram("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    });
    if (edited) return;
  }
  await send(chatId, text, extra);
}

async function loadBarber(barberId: string): Promise<BarberCard | null> {
  const [row] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      brandName: usersTable.brandName,
      address: usersTable.address,
      mapLink: usersTable.mapLink,
      latitude: usersTable.latitude,
      longitude: usersTable.longitude,
      phone: usersTable.phone,
      botPhone: usersTable.botPhone,
      phoneVisible: usersTable.phoneVisible,
      username: usersTable.username,
      telegramId: usersTable.telegramId,
      eveningConfirm: usersTable.notifClientEvening,
      quickReminder: usersTable.notifClientQuick,
      autoCancel: usersTable.notifClientAutoCancel,
      notifyCancel: usersTable.notifCancellation,
      cancelLimit: usersTable.clientCancelLimit,
    })
    .from(usersTable)
    .where(eq(usersTable.id, barberId))
    .limit(1);
  return row ?? null;
}

async function shownService(booking: BookingCard, lang: ClientLang): Promise<string> {
  const fallback = booking.serviceName?.trim() || ct(lang, "Xizmat", "Услуга");
  if (lang !== "ru") return fallback;
  const [session] = await db
    .select({ bookingData: bookingSessionsTable.bookingData })
    .from(bookingSessionsTable)
    .where(eq(bookingSessionsTable.bookingId, booking.id))
    .limit(1);
  if (!session?.bookingData) return fallback;
  try {
    const data = JSON.parse(session.bookingData) as { services?: Array<{ name?: string; nameRu?: string | null }> };
    return serviceLabel("ru", data.services, fallback);
  } catch {
    return fallback;
  }
}

async function loadBooking(bookingId: string): Promise<BookingCard | null> {
  const [row] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  return row ?? null;
}

async function findTelegram(barberId: string, phone: string | null, clientId: string | null): Promise<string | null> {
  if (clientId) {
    const [client] = await db
      .select({ telegramId: clientsTable.telegramId, phone: clientsTable.phone })
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId))
      .limit(1);
    if (client?.telegramId) return client.telegramId;
    if (!phone && client?.phone) phone = client.phone;
  }
  if (!phone) return null;

  const clients = await db
    .select({ telegramId: clientsTable.telegramId, phone: clientsTable.phone })
    .from(clientsTable)
    .where(and(eq(clientsTable.barberId, barberId), isNotNull(clientsTable.telegramId)));
  const clientHit = clients.find((row) => row.telegramId && phonesMatch(row.phone, phone));
  if (clientHit?.telegramId) return clientHit.telegramId;

  const sessions = await db
    .select({
      clientTelegramId: bookingSessionsTable.clientTelegramId,
      clientPhone: bookingSessionsTable.clientPhone,
    })
    .from(bookingSessionsTable)
    .where(and(eq(bookingSessionsTable.barberId, barberId), isNotNull(bookingSessionsTable.clientTelegramId)));
  const sessionHit = sessions.find((row) => row.clientTelegramId && phonesMatch(row.clientPhone, phone));
  return sessionHit?.clientTelegramId ?? null;
}

function rebookMarkup(username: string, lang: ClientLang = "uz") {
  return { inline_keyboard: [[{ text: ct(lang, "📱 Qayta bron qilish", "📱 Записаться снова"), url: rebookUrl(username) }]] };
}

export async function deliverBookingReceipt(
  bookingId: string,
  hint?: { telegramId?: string | null; phone?: string | null; keepConfirmed?: boolean },
): Promise<boolean> {
  const booking = await loadBooking(bookingId);
  if (!booking || booking.deletedAt) return false;
  if (booking.status === "cancelled" || booking.status === "auto_cancelled" || booking.status === "completed") {
    return false;
  }
  if (booking.clientTelegramId && !hint?.keepConfirmed) return true;

  const barber = await loadBarber(booking.barberId);
  if (!barber) return false;

  let chat = hint?.telegramId || booking.clientTelegramId;
  if (!chat) chat = await findTelegram(booking.barberId, hint?.phone ?? null, booking.clientId);
  if (!chat) return false;

  const lang = asClientLang(booking.clientLang);
  const service = await shownService(booking, lang);
  const time = booking.startTime.slice(0, 5);
  const minutesLeft = (appointmentMs(booking.date, time) - Date.now()) / 60000;
  const message = clientReceiptMessage({
    barber,
    clientName: booking.clientName,
    service,
    price: booking.price,
    date: booking.date,
    time,
    minutesLeft,
    bookingId: booking.id,
    lang,
  });
  const ok = await send(chat, message.text, { reply_markup: message.reply_markup });
  if (!ok) return false;
  if (message.cancelMarkup) {
    await send(chat, ct(lang, "Bronni bekor qilmoqchi bo‘lsangiz, shu tugmani bosing.", "Если хотите отменить запись, нажмите кнопку."), {
      reply_markup: message.cancelMarkup,
    });
  }

  await db.update(bookingsTable).set({
    clientTelegramId: chat,
    clientConfirmed: true,
    status: "confirmed",
    updatedAt: new Date(),
  }).where(eq(bookingsTable.id, booking.id));

  if (booking.clientId) {
    await db.update(clientsTable)
      .set({ telegramId: chat, updatedAt: new Date() })
      .where(and(eq(clientsTable.id, booking.clientId), isNull(clientsTable.telegramId)));
  }
  return true;
}

function ownsChat(booking: BookingCard, chatId: number): boolean {
  return !!booking.clientTelegramId && booking.clientTelegramId === String(chatId);
}

export async function handleClientConfirm(
  bookingId: string,
  chatId: number,
  messageId?: number,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  const lang = asClientLang(booking?.clientLang);
  if (!booking || !ownsChat(booking, chatId)) {
    await send(String(chatId), ct(lang, "Bron topilmadi.", "Запись не найдена."));
    return;
  }
  if (booking.status === "cancelled" || booking.status === "auto_cancelled") {
    await send(String(chatId), ct(lang, "Bu navbat allaqachon bekor qilingan.", "Эта запись уже отменена."));
    return;
  }
  await db.update(bookingsTable).set({
    status: "confirmed",
    clientConfirmed: true,
    updatedAt: new Date(),
  }).where(eq(bookingsTable.id, booking.id));
  await editOrSend(String(chatId), messageId, confirmedText(lang), { reply_markup: { inline_keyboard: [] } });
}

export async function handleClientCancel(
  bookingId: string,
  chatId: number,
  messageId?: number,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  const lang = asClientLang(booking?.clientLang);
  if (!booking || !ownsChat(booking, chatId)) {
    await send(String(chatId), ct(lang, "Bron topilmadi.", "Запись не найдена."));
    return;
  }
  if (booking.status === "cancelled" || booking.status === "auto_cancelled") {
    await send(String(chatId), ct(lang, "Bu navbat allaqachon bekor qilingan.", "Эта запись уже отменена."));
    return;
  }
  const barber = await loadBarber(booking.barberId);
  if (!barber) return;

  const minutesLeft = (appointmentMs(booking.date, booking.startTime) - Date.now()) / 60000;
  const limit = normalizeCancelLimit(barber.cancelLimit);
  if (minutesLeft <= limit) {
    await editOrSend(String(chatId), messageId, tooLateText(barber, limit, lang), { reply_markup: { inline_keyboard: [] } });
    return;
  }

  await send(String(chatId), ct(lang, "Haqiqatan ham ushbu bronni bekor qilmoqchimisiz?", "Точно хотите отменить эту запись?"), {
    reply_markup: {
      inline_keyboard: [[
        { text: ct(lang, "✅ Ha, bekor qilish", "✅ Да, отменить"), callback_data: `clyes_${booking.id}` },
        { text: ct(lang, "🛑 Bekor qilmaslik", "🛑 Не отменять"), callback_data: `clno_${booking.id}` },
      ]],
    },
  });
}

export async function handleClientCancelYes(
  bookingId: string,
  chatId: number,
  messageId?: number,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  const lang = asClientLang(booking?.clientLang);
  if (!booking || !ownsChat(booking, chatId)) {
    await send(String(chatId), ct(lang, "Bron topilmadi.", "Запись не найдена."));
    return;
  }
  if (booking.status === "cancelled" || booking.status === "auto_cancelled") {
    await editOrSend(String(chatId), messageId, ct(lang, "Bu navbat allaqachon bekor qilingan.", "Эта запись уже отменена."), { reply_markup: { inline_keyboard: [] } });
    return;
  }
  const barber = await loadBarber(booking.barberId);
  if (!barber) return;

  const minutesLeft = (appointmentMs(booking.date, booking.startTime) - Date.now()) / 60000;
  const limit = normalizeCancelLimit(barber.cancelLimit);
  if (minutesLeft <= limit) {
    await editOrSend(String(chatId), messageId, tooLateText(barber, limit, lang), { reply_markup: { inline_keyboard: [] } });
    return;
  }

  await db.update(bookingsTable).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(eq(bookingsTable.id, booking.id));
  await syncClientMetrics(booking.clientId, booking.barberId);
  await db.update(bookingSessionsTable).set({ status: "cancelled" })
    .where(eq(bookingSessionsTable.bookingId, booking.id));

  await editOrSend(String(chatId), messageId, cancelledText(lang), {
    reply_markup: rebookMarkup(barber.username, lang),
  });

  const barberChat = await bindBarberTelegramChat(barber);
  if (barberChat && barber.notifyCancel !== false) {
    let phone: string | null = null;
    if (booking.clientId) {
      const [client] = await db
        .select({ phone: clientsTable.phone })
        .from(clientsTable)
        .where(eq(clientsTable.id, booking.clientId))
        .limit(1);
      phone = client?.phone ?? null;
    }
    await sendToBarber(
      barberChat,
      clientCancelledBarberText(
        booking.clientName,
        phone,
        booking.serviceName?.trim() || "Xizmat",
        booking.date,
        booking.startTime.slice(0, 5),
      ),
    );
  }
}

export type BarberBookingChange =
  | { kind: "cancelled" }
  | { kind: "rescheduled"; from: { date: string; time: string } };

/**
 * The barber cancelled or moved a booking in the app: tell the client on Telegram at once.
 * Returns false when the client has no Telegram chat or the message could not be sent.
 */
export async function notifyClientOfBarberChange(bookingId: string, change: BarberBookingChange): Promise<boolean> {
  const booking = await loadBooking(bookingId);
  if (!booking || booking.deletedAt) return false;

  let chat = booking.clientTelegramId;
  if (!chat && booking.clientId) {
    const [client] = await db
      .select({ telegramId: clientsTable.telegramId })
      .from(clientsTable)
      .where(eq(clientsTable.id, booking.clientId))
      .limit(1);
    chat = client?.telegramId ?? null;
  }
  if (!chat) return false;

  const barber = await loadBarber(booking.barberId);
  if (!barber) return false;

  const lang = asClientLang(booking.clientLang);
  const service = await shownService(booking, lang);
  const time = booking.startTime.slice(0, 5);

  if (change.kind === "cancelled") {
    return send(chat, barberCancelledText(barber, service, booking.date, time, lang), {
      reply_markup: rebookMarkup(barber.username, lang),
    });
  }
  return send(chat, barberRescheduledText(barber, service, change.from, { date: booking.date, time }, lang));
}

export async function runClientNotificationCycle(now = Date.now()): Promise<void> {
  if (!token()) return;

  const rows = await db.select().from(bookingsTable).where(and(
    inArray(bookingsTable.status, [...OPEN_STATUSES]),
    isNull(bookingsTable.deletedAt),
    isNotNull(bookingsTable.clientTelegramId),
  ));

  const barbers = new Map<string, BarberCard | null>();
  async function barberOf(id: string): Promise<BarberCard | null> {
    if (!barbers.has(id)) barbers.set(id, await loadBarber(id));
    return barbers.get(id) ?? null;
  }

  for (const booking of rows) {
    if (!booking.clientTelegramId) continue;
    const barber = await barberOf(booking.barberId);
    if (!barber) continue;
    const lang = asClientLang(booking.clientLang);
    const service = await shownService(booking, lang);
    const time = booking.startTime.slice(0, 5);
    const minutesLeft = (appointmentMs(booking.date, time) - now) / 60000;
    if (minutesLeft < 0) continue;

    if (barber.eveningConfirm !== false && !booking.reminded24h && minutesLeft <= 1440 && minutesLeft > 1430) {
      const message = reminder24Message({
        barber,
        clientName: booking.clientName,
        service,
        time,
        bookingId: booking.id,
        lang,
      });
      const ok = await send(booking.clientTelegramId, message.text, { reply_markup: message.reply_markup });
      if (ok) {
        await db.update(bookingsTable).set({ reminded24h: true }).where(eq(bookingsTable.id, booking.id));
      }
    }

    if (barber.quickReminder !== false && !booking.reminded1h && minutesLeft <= 65 && minutesLeft >= 55) {
      const message = reminder1hMessage({
        barber,
        clientName: booking.clientName,
        service,
        time,
        bookingId: booking.id,
        lang,
      });
      const ok = await send(booking.clientTelegramId, message.text, message.reply_markup
        ? { reply_markup: message.reply_markup }
        : {});
      if (ok) {
        await db.update(bookingsTable).set({ reminded1h: true }).where(eq(bookingsTable.id, booking.id));
      }
    }
  }
}

export function isClientCallback(data: string): "confirm" | "cancel" | "cancel_yes" | "cancel_no" | null {
  if (/^clyes_[0-9a-f-]{36}$/i.test(data)) return "cancel_yes";
  if (/^clno_[0-9a-f-]{36}$/i.test(data)) return "cancel_no";
  const confirm = data.match(/^confirm_([0-9a-f-]{36})$/i);
  if (confirm?.[1] && UUID_RE.test(confirm[1])) return "confirm";
  const cancel = data.match(/^cancel_([0-9a-f-]{36})$/i);
  if (cancel?.[1] && UUID_RE.test(cancel[1])) return "cancel";
  return null;
}

export function callbackBookingId(data: string): string {
  return data.slice(data.indexOf("_") + 1);
}

/** Sample messages for /eslatma. Does not read or change bookings. */
export async function sendReminderPreview(chatId: string | number): Promise<void> {
  const id = String(chatId);
  let barber: BarberCard = {
    id: "preview",
    name: "Barber.uz",
    brandName: "Barber.uz",
    address: "Chilonzor, 9-kvartal (Moʻljal: Metro yonida)",
    mapLink: "https://maps.google.com/?q=Chilonzor",
    latitude: null,
    longitude: null,
    phone: "+998901234567",
    phoneVisible: true,
    username: "barber",
    telegramId: null,
  };
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        brandName: usersTable.brandName,
        address: usersTable.address,
        mapLink: usersTable.mapLink,
        latitude: usersTable.latitude,
        longitude: usersTable.longitude,
        phone: usersTable.phone,
        phoneVisible: usersTable.phoneVisible,
        username: usersTable.username,
        telegramId: usersTable.telegramId,
      })
      .from(usersTable)
      .where(eq(usersTable.telegramId, id))
      .limit(1);
    if (user) {
      barber = {
        ...barber,
        ...user,
        address: user.address || barber.address,
        mapLink: user.mapLink || (user.latitude && user.longitude ? null : barber.mapLink),
        latitude: user.latitude,
        longitude: user.longitude,
        phone: user.phone || barber.phone,
      };
    }
  } catch {
    // Sample salon details are enough.
  }

  const sample = {
    barber: { ...barber, cancelLimit: 60 },
    clientName: "Ali",
    service: "Soch olish",
    time: "15:00",
    bookingId: "00000000-0000-4000-8000-000000000000",
  };
  const receipt = clientReceiptMessage({
    ...sample,
    price: 50000,
    date: tashkentNow().date,
    minutesLeft: 180,
  });
  const dayBefore = reminder24Message(sample);
  const soon = reminder1hMessage(sample);

  await send(id, "Bu sinov. Haqiqiy mijozga xabar ketmadi va hech qanday bron o'zgarmaydi.");
  await send(id, receipt.text, receipt.reply_markup ? { reply_markup: receipt.reply_markup } : {});
  await send(id, dayBefore.text, { reply_markup: dayBefore.reply_markup });
  await send(id, soon.text, soon.reply_markup ? { reply_markup: soon.reply_markup } : {});
}

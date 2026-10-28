/**
 * Morning schedule text for the barber. Clients never receive this message.
 * Times and the date label are already in Uzbekistan time.
 */

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const DIVIDER = "━".repeat(19);

export type MorningBooking = {
  time: string;
  clientName: string;
  serviceName: string | null;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function uzDateLabel(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${day}-${MONTHS[(month || 1) - 1]}`;
}

export function clockTime(raw: string): string {
  const [h = "0", m = "0"] = raw.split(":");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`.slice(0, 5);
}

export function buildBarberMorningSummary(dateLabel: string, bookings: MorningBooking[]): string {
  if (bookings.length === 0) {
    return "☀️ Xayrli tong!\n\n🌿 Bugun uchun hech qanday bron yo‘q. Yaxshilab dam oling!";
  }

  const lines = [...bookings]
    .sort((a, b) => clockTime(a.time).localeCompare(clockTime(b.time)))
    .map((booking) => {
      const name = esc(booking.clientName.trim() || "Mijoz");
      const service = booking.serviceName?.trim();
      const servicePart = service ? ` (${esc(service)})` : "";
      return `⏰ ${clockTime(booking.time)} — ${name}${servicePart}`;
    })
    .join("\n");

  return [
    `☀️ Xayrli tong! Bugungi (${esc(dateLabel)}) bronlar jadvali:`,
    "",
    DIVIDER,
    lines,
    DIVIDER,
    "",
    `<b>Bugun jami ${bookings.length} ta bron mavjud. Omad tilaymiz! 💈</b>`,
  ].join("\n");
}

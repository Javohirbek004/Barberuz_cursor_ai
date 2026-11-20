import { useEffect, useState } from "react";

const FALLBACK_BOT_USERNAME = "BARBERUZ_YORDAMCHI_BOT";

/** The bot the barber opens from Ulash. */
export const BARBER_CONNECT_BOT = "ZumioAppBot";
export const BOT_LINK_PENDING_KEY = "zumio_bot_link_pending";

export function openBarberBot(barberId: string) {
  if (!barberId) return;
  try { localStorage.setItem(BOT_LINK_PENDING_KEY, "1"); } catch { /* storage can be blocked */ }
  window.location.href = `https://t.me/${BARBER_CONNECT_BOT}?start=${barberId}`;
}

let pending: Promise<string> | null = null;

function cleanUsername(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^@/, "");
}

/** The live bot name saved on the server. Same buttons, only the bot they open changes. */
export function loadBotUsername(): Promise<string> {
  if (!pending) {
    pending = fetch("/api/telegram/status")
      .then((res) => res.json())
      .then((data: { username?: unknown }) => cleanUsername(data?.username) || FALLBACK_BOT_USERNAME)
      .catch(() => FALLBACK_BOT_USERNAME);
  }
  return pending;
}

export function useBotUsername(): string {
  const [name, setName] = useState(FALLBACK_BOT_USERNAME);
  useEffect(() => {
    let live = true;
    loadBotUsername().then((next) => {
      if (live && next) setName(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return name;
}

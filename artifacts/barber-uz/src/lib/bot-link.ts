import { useEffect, useState } from "react";

const FALLBACK_BOT_USERNAME = "BARBERUZ_YORDAMCHI_BOT";

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

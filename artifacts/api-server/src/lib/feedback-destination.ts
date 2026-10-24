function firstFilled(...values: Array<string | undefined>): string {
  for (const value of values) {
    let trimmed = value?.trim() ?? "";
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      trimmed = trimmed.slice(1, -1).trim();
    }
    if (trimmed) return trimmed;
  }
  return "";
}

function looksLikeBotToken(value: string): boolean {
  return /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(value);
}

function looksLikeChatId(value: string): boolean {
  return /^-?\d{5,}$/.test(value);
}

/** Token and the chat that should receive feedback. A username in the token field is ignored. */
export function feedbackDestination(env: NodeJS.ProcessEnv = process.env): { token: string; chatId: string } {
  const token = [env.FEEDBACKS_BOT_TOKEN, env.FEEDBACKS_BOT_TOKE, env.FEEDBACKS_BOT]
    .map((value) => firstFilled(value))
    .find(looksLikeBotToken) || "";
  const chatId = [env.FEEDBACKS_BOT_ID, env.ADMIN_TELEGRAM_ID]
    .map((value) => firstFilled(value))
    .find(looksLikeChatId) || "";
  return { token, chatId };
}

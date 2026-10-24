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

function tokenCandidates(env: NodeJS.ProcessEnv): Array<{ name: string; token: string }> {
  const pairs: Array<[string, string | undefined]> = [
    ["FEEDBACKS_BOT_TOKEN", env.FEEDBACKS_BOT_TOKEN],
    ["FEEDBACKS_BOT_TOKE", env.FEEDBACKS_BOT_TOKE],
    ["FEEDBACKS_BOT", env.FEEDBACKS_BOT],
  ];
  const seen = new Set<string>();
  const out: Array<{ name: string; token: string }> = [];
  for (const [name, raw] of pairs) {
    const token = firstFilled(raw);
    if (!looksLikeBotToken(token) || seen.has(token)) continue;
    seen.add(token);
    out.push({ name, token });
  }
  return out;
}

async function telegramUsername(token: string): Promise<string> {
  try {
    const data = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()) as {
      ok?: boolean;
      result?: { username?: string };
    };
    return data.ok ? (data.result?.username || "") : "";
  } catch {
    return "";
  }
}

/** Pick the token whose bot name matches FEEDBACKS_BOT_USERNAME, otherwise the first real token. */
export async function resolveFeedbackBot(env: NodeJS.ProcessEnv = process.env): Promise<{
  token: string;
  chatId: string;
  username: string;
  wanted: string;
  found: Array<{ name: string; username: string }>;
}> {
  const chatId = [env.FEEDBACKS_BOT_ID, env.ADMIN_TELEGRAM_ID]
    .map((value) => firstFilled(value))
    .find(looksLikeChatId) || "";
  const wanted = firstFilled(env.FEEDBACKS_BOT_USERNAME).replace(/^@/, "");
  const found: Array<{ name: string; username: string }> = [];
  let token = "";
  let username = "";
  for (const item of tokenCandidates(env)) {
    const botName = await telegramUsername(item.token);
    found.push({ name: item.name, username: botName });
    if (!botName) continue;
    if (!token) {
      token = item.token;
      username = botName;
    }
    if (wanted && botName.toLowerCase() === wanted.toLowerCase()) {
      token = item.token;
      username = botName;
      break;
    }
  }
  return { token, chatId, username, wanted, found };
}

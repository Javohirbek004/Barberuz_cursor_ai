function firstFilled(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** Token and the chat that should receive feedback. Names match the live server settings. */
export function feedbackDestination(env: NodeJS.ProcessEnv = process.env): { token: string; chatId: string } {
  return {
    token: firstFilled(env.FEEDBACKS_BOT, env.FEEDBACKS_BOT_TOKEN, env.FEEDBACKS_BOT_TOKE),
    chatId: firstFilled(env.ADMIN_TELEGRAM_ID, env.FEEDBACKS_BOT_USERNAME),
  };
}

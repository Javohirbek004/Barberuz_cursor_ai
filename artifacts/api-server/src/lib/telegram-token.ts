/** Render and other hosted runtimes own the live bot. Local dev must not. */
export function isRenderHost(): boolean {
  return Boolean(
    process.env.RENDER ||
      process.env.RENDER_EXTERNAL_HOSTNAME ||
      process.env.RENDER_SERVICE_ID,
  );
}

export function isProductionRuntime(): boolean {
  return isRenderHost() || process.env.NODE_ENV === "production";
}

export function getTelegramBotToken(): string {
  if (!isProductionRuntime()) {
    return (
      process.env.TELEGRAM_BOT_TOKEN_TEST?.trim() ||
      process.env.TELEGRAM_TEST_BOT_TOKEN?.trim() ||
      ""
    );
  }
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export function shouldRegisterTelegramWebhook(): boolean {
  return isProductionRuntime();
}

export function shouldPollTelegram(): boolean {
  if (isProductionRuntime()) return false;
  return Boolean(getTelegramBotToken());
}

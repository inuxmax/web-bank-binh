/**
 * Chạy một lần khi server Node khởi động (next dev / next start).
 * Khởi động Telegram bot nếu có TELEGRAM_BOT_TOKEN — cùng process với web.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    return;
  }

  try {
    const { startTelegramBot } = await import('@/lib/server/telegram-bot');
    /** Không await: `bot.launch()` chờ polling vô hạn, await sẽ kẹt khởi động Next. */
    void startTelegramBot({ registerSignalHandlers: false, exitOnMissingToken: false }).catch((e) => {
      console.error('[instrumentation] Telegram bot:', e);
    });
  } catch (e) {
    console.error('[instrumentation] Không import được Telegram bot:', e);
  }
}

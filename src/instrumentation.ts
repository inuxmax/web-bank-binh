/**
 * Chạy một lần khi server Node khởi động (next dev / next start).
 * Khởi động Telegram bot nếu có TELEGRAM_BOT_TOKEN — cùng process với web.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }
  const pollEnabled = String(process.env.HPAY_UNPAID_POLLING_ENABLED || 'true').trim().toLowerCase() !== 'false';
  if (pollEnabled) {
    try {
      const { startVaSyncPoller } = await import('@/lib/server/va-sync-poller');
      startVaSyncPoller();
    } catch (e) {
      console.error('[instrumentation] VA sync poller:', e);
    }
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

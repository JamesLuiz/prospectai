/**
 * Next.js boot hook — `register()` runs once when the server process starts.
 *
 * We use it to auto-start the internal cron scheduler so background jobs (email /
 * WhatsApp / Workana sending, scans, replies) run whenever the server is up and
 * survive launchd/KeepAlive restarts. Previously the scheduler only started from a
 * manual toggle in Settings, so every restart silently stopped ALL automation until
 * someone re-enabled it — which would also strand the Workana auto-sender.
 *
 * This is safe: it only TICKS the cron. Each job self-gates on its own flags —
 * email sends only already-approved+due mail within the send window, the Workana
 * auto-sender only approved proposals with budget/interval left, etc. — so nothing
 * goes out that the user hasn't already enabled. The scheduler can still be stopped
 * from Settings.
 */
export async function register() {
  // Only run in the Node.js server runtime (not Edge), and never during build.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Surface the most common deployment mistakes in the container logs instead
  // of waiting for the first failed login.
  try {
    const missing = ["AUTH_USERNAME", "AUTH_PASSWORD_HASH"].filter(
      (key) => !process.env[key]?.trim()
    );
    if ((process.env.AUTH_SECRET || "").length < 32) {
      missing.push("AUTH_SECRET (min 32 chars)");
    }
    if (missing.length > 0) {
      const { logger } = await import("@/lib/logger");
      logger.warn(
        `[auth] Missing or invalid ${missing.join(", ")} — login returns 503 until these exist in the container environment.`
      );
    }
  } catch {
    // Diagnostics must never block boot.
  }

  try {
    const { getSetting, getGmapsScraperUrl } = await import("@/db");

    const scraperUrl = getGmapsScraperUrl();
    if (
      process.env.NODE_ENV === "production" &&
      /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(scraperUrl)
    ) {
      const { logger } = await import("@/lib/logger");
      logger.warn(
        `[scraper] Resolved URL is ${scraperUrl}. Inside Docker that is the app container itself; set GMAPS_SCRAPER_URL=http://gmaps-scraper:8080 (or update Settings) and restart.`
      );
    }

    // Opt-in only: the engine auto-starts on boot ONLY when the user has turned it
    // on. Default off so a restart never silently resumes sending (email/WhatsApp/
    // Workana). The user enables this once they want always-on automation.
    if (getSetting("scheduler_autostart") !== "true") return;
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  } catch (err) {
    // Never let a scheduler hiccup block the server from starting.
    const { logger } = await import("@/lib/logger");
    logger.error({ err: err instanceof Error ? err.message : err }, "[instrumentation] startScheduler failed");
  }
}

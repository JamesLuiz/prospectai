import { sqlite } from "./connection";

// Insert default settings if not exist
const defaultSettings: Record<string, string> = {
  // Agency identity — configure these in Settings after first login
  agency_name: "",
  agency_url: "",
  agency_description: "",
  // Services offered (comma-separated)
  agency_services: "",
  // Country & locale
  target_country: "",
  phone_country_code: "",
  phone_digits: "",
  locale: "en-US",
  currency: "USD",
  // Email settings
  from_email: "",
  from_name: "",
  global_daily_limit: "45",
  default_tone: "professional",
  // Compliance
  unsubscribe_url: "",
  legal_footer: "",
  // Warmup
  warmup_enabled: "true",
  warmup_day: "1",
  warmup_start_limit: "5",
  warmup_increment: "3",
  warmup_max_limit: "45",
  // Daily window (local hours) the senders are allowed to run in. Approvals are
  // scheduled inside this window (see send_next_day / send-schedule).
  send_window_start: "10",
  send_window_end: "12",
  // Scheduling: defer approved messages to the NEXT day's window (true) vs the
  // soonest window (false), and skip weekends (roll Sat/Sun → Monday).
  send_next_day: "true",
  send_skip_weekends: "true",
  // Days to wait after the primary email before the WhatsApp fallback is released.
  fallback_delay_days: "3",
  // Scraping
  scrape_concurrency: "3",
  scrape_delay_ms: "2000",
  autopilot_global: "false",
  gmaps_scraper_url: process.env.GMAPS_SCRAPER_URL || "http://localhost:8081",
  gmaps_scraper_api_key: "",
  // AI engine: which provider powers copy, analysis and the chatbot.
  // One of: claude_cli (local `claude -p`, default) | gemini | anthropic | mistral | openai
  ai_provider: "claude_cli",
  // Provider API keys — a non-empty DB value overrides the .env var
  gemini_api_key: "",
  anthropic_api_key: "",
  mistral_api_key: "",
  openai_api_key: "",
  resend_api_key: "",
  // Reply-To
  reply_to_email: "",
  // Email sending provider: resend (default) | smtp (real mailbox, e.g. Workspace)
  email_provider: "resend",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_password: "",
  // IMAP — capture email replies by reading a real mailbox (the reply_to inbox)
  imap_enabled: "false",
  imap_host: "",
  imap_port: "993",
  imap_user: "",
  imap_password: "",
  imap_last_uid: "",
  // Tracking
  tracking_base_url: "",
  // CRM
  crm_webhook_url: "",
  crm_webhook_on: "replied",
  // Chatbot
  chatbot_provider: "gemini",
  // Proactive in-thread nudges on page change. Only fires with the claude_cli
  // provider (Sonnet); the model itself decides whether a nudge is worthwhile.
  proactive_chat_enabled: "true",
  // Unrestricted "developer" mode: lets the claude_cli chat agent read/edit files,
  // run shell and SQL like Claude Code. OFF by default — localhost only.
  chatbot_dev_mode: "false",
  // WhatsApp
  wa_daily_limit: "20",
  // WhatsApp warm-up — ON by default. Unofficial whatsapp-web.js numbers ban
  // easily, so ramp gently: 5 → +3/day → 20 (≈6 active days to steady state).
  wa_warmup_enabled: "true",
  wa_warmup_day: "1",
  wa_warmup_start_limit: "5",
  wa_warmup_increment: "3",
  wa_warmup_max_limit: "20",
  // Workana add-on (optional) — opt-in browser automation for assisted bidding.
  // workana_auth_state: disconnected | connected | needs_reauth
  workana_enabled: "false",
  workana_weekly_connections: "10",
  workana_profile_url: "",
  workana_auth_state: "disconnected",
  workana_last_scan_at: "",
  // headless background scans; the interactive connect always opens headful
  workana_headless: "true",
  workana_locale: "es-AR",
  workana_timezone: "America/Argentina/Buenos_Aires",
  workana_scan_interval_hours: "12",
  workana_max_eval_per_scan: "15",
  workana_max_drafts_per_scan: "5",
  // Hard gate for REAL proposal submission. Stays "false" until the user opts in.
  workana_allow_submit: "false",
  workana_replies_interval_hours: "2",
  workana_last_replies_at: "",
  // Portfolio knowledge base (structured projects + AI interview) — on by default.
  portfolio_enabled: "true",
  // Pre-generate a suggested reply in the cron for interested/question replies so
  // the inbox is "ready"; the user still edits/approves before anything is sent.
  reply_autosuggest_enabled: "true",
};

export function initializeDefaultSettings(): void {
  for (const [key, value] of Object.entries(defaultSettings)) {
    sqlite.exec(`INSERT OR IGNORE INTO settings (key, value) VALUES ('${key}', '${value}')`);
  }
}

/**
 * Resolve the Google Maps scraper URL.
 *
 * The value saved in Settings wins, except when it is still the built-in
 * `http://localhost:8081` default: inside Docker that points at the app
 * container itself, not the scraper. In that case GMAPS_SCRAPER_URL is used,
 * so a redeploy that recreates the database (and re-seeds the default) still
 * routes to the scraper service. A trailing slash is trimmed because callers
 * append paths such as `/scrape`.
 */
export function getGmapsScraperUrl(): string {
  const normalize = (value: string | null | undefined) =>
    (value || "").trim().replace(/\/+$/, "");

  const fromDb = normalize(getSetting("gmaps_scraper_url"));
  const fromEnv = normalize(process.env.GMAPS_SCRAPER_URL);
  const isLocalDefault =
    !fromDb || fromDb === "http://localhost:8081" || fromDb === "http://127.0.0.1:8081";

  return (isLocalDefault ? fromEnv || fromDb : fromDb) || "http://localhost:8081";
}

export function getSetting(key: string): string | null {
  const row = sqlite.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  sqlite.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
}

/**
 * Resolve a provider API key: prefer the value stored in the settings table,
 * otherwise fall back to the environment variable. Lets keys be managed from
 * the app UI without a restart while keeping `.env` working when unset.
 */
/**
 * Keys pasted from a dashboard/.env file sometimes keep wrapping quotes or a
 * pasted "Bearer " prefix. Providers reject those with 401 even when the token
 * itself is valid, so normalise before handing the key to an SDK.
 */
function normalizeApiKey(value: string): string {
  let key = value.trim();
  if (
    key.length >= 2 &&
    ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'")))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/^Bearer\s+/i, "").trim();
}

export function getApiKey(settingKey: string, envName: string): string {
  const fromDb = getSetting(settingKey);
  const raw = fromDb && fromDb.trim() ? fromDb : process.env[envName] || "";
  // Only API keys get the quote/Bearer normalisation; SMTP/IMAP passwords keep
  // their exact value apart from surrounding whitespace.
  return settingKey.endsWith("_api_key") ? normalizeApiKey(raw) : raw.trim();
}

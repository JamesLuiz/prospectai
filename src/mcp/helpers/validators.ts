import { getSetting, getApiKey } from "@/db";

export interface ConfigCheck {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

export function checkGeminiConfig(): ConfigCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!getApiKey("gemini_api_key", "GEMINI_API_KEY")) missing.push("GEMINI_API_KEY env var");
  return { ok: missing.length === 0, missing, warnings };
}

export function checkAnthropicConfig(): ConfigCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!getApiKey("anthropic_api_key", "ANTHROPIC_API_KEY")) missing.push("ANTHROPIC_API_KEY env var");
  return { ok: missing.length === 0, missing, warnings };
}

export function checkMistralConfig(): ConfigCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!getApiKey("mistral_api_key", "MISTRAL_API_KEY")) missing.push("MISTRAL_API_KEY env var");
  return { ok: missing.length === 0, missing, warnings };
}

export function checkOpenAIConfig(): ConfigCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!getApiKey("openai_api_key", "OPENAI_API_KEY")) missing.push("OPENAI_API_KEY env var");
  return { ok: missing.length === 0, missing, warnings };
}

/**
 * AI readiness for the provider actually selected in Settings. `claude_cli` needs
 * no API key (it uses the logged-in CLI), so it never blocks a campaign.
 */
export function checkAiConfig(): ConfigCheck {
  const provider = getSetting("ai_provider") || "claude_cli";
  if (provider === "anthropic") return checkAnthropicConfig();
  if (provider === "mistral") return checkMistralConfig();
  if (provider === "openai") return checkOpenAIConfig();
  if (provider === "gemini") return checkGeminiConfig();
  return { ok: true, missing: [], warnings: [] };
}

export function checkEmailConfig(): ConfigCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!getApiKey("resend_api_key", "RESEND_API_KEY")) missing.push("RESEND_API_KEY env var");
  const fromEmail = getSetting("from_email");
  if (!fromEmail) missing.push("from_email setting");
  const fromName = getSetting("from_name");
  if (!fromName) warnings.push("from_name not set (will use agency_name)");
  const unsubUrl = getSetting("unsubscribe_url");
  if (!unsubUrl) warnings.push("unsubscribe_url not configured (RGPD compliance)");
  return { ok: missing.length === 0, missing, warnings };
}

export function checkWhatsAppConfig(): ConfigCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  // WA is managed by the web app process, MCP just queues messages
  warnings.push("WhatsApp is managed by the web app. Check connection status in the dashboard.");
  return { ok: true, missing, warnings };
}

export function checkScraperConfig(): ConfigCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  const scraperUrl = getSetting("gmaps_scraper_url");
  if (!scraperUrl) missing.push("gmaps_scraper_url setting");
  return { ok: missing.length === 0, missing, warnings };
}

export function checkFullConfig(): Record<string, ConfigCheck> {
  return {
    ai: checkAiConfig(),
    email: checkEmailConfig(),
    whatsapp: checkWhatsAppConfig(),
    scraper: checkScraperConfig(),
  };
}

// Settings that can be modified via MCP
export const SAFE_SETTINGS_KEYS = [
  "agency_name", "agency_url", "agency_description", "agency_services",
  "target_country", "phone_country_code", "phone_digits", "locale", "currency",
  "from_email", "from_name", "global_daily_limit", "default_tone",
  "unsubscribe_url", "legal_footer", "reply_to_email",
  "warmup_enabled", "warmup_start_limit", "warmup_increment", "warmup_max_limit",
  "send_window_start", "send_window_end",
  "scrape_concurrency", "scrape_delay_ms", "autopilot_global",
  "wa_daily_limit",
];

const BLOCKED_PATTERN = /api_key|secret|password|hash|token|auth/i;

export function isSafeSetting(key: string): boolean {
  return SAFE_SETTINGS_KEYS.includes(key) && !BLOCKED_PATTERN.test(key);
}

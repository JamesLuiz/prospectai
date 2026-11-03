import { NextRequest, NextResponse } from "next/server";
import {
  validateBody,
  updateSettingsSchema,
  ALLOWED_SETTINGS_KEYS,
  isAllowedSettingKey,
} from "@/lib/validations";
import * as settingsService from "@/services/settings.service";
import { handleServiceError } from "@/services/api-handler";
import { getApiKey } from "@/db";
import { logger } from "@/lib/logger";

// Secret settings: never sent to the client as plaintext. Instead we expose a
// `<key>_configured` boolean so the UI can show "configured" without the value.
const SECRET_KEYS: Array<[string, string]> = [
  ["gemini_api_key", "GEMINI_API_KEY"],
  ["anthropic_api_key", "ANTHROPIC_API_KEY"],
  ["resend_api_key", "RESEND_API_KEY"],
  ["gmaps_scraper_api_key", ""],
  ["imap_password", "IMAP_PASSWORD"],
  ["smtp_password", "SMTP_PASSWORD"],
];

export async function GET() {
  try {
    const all = settingsService.getAllSettings();
    // Only expose user-editable keys. Internal rows (`*_migrated`, `_send_lock_*`,
    // `imap_last_uid`, `quality_threshold`) stay server-side: the UI echoes back
    // everything it receives, and unknown keys fail validation on save.
    const data: Record<string, string> = {};
    for (const key of ALLOWED_SETTINGS_KEYS) {
      if (key === "imap_last_uid") continue;
      data[key] = all[key] ?? "";
    }

    for (const [key, env] of SECRET_KEYS) {
      const configured = env ? !!getApiKey(key, env) : !!(data[key] && data[key].trim());
      data[`${key}_configured`] = configured ? "true" : "false";
      data[key] = "";
    }
    return NextResponse.json(data);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Expected an object of setting keys to values" },
      { status: 400 }
    );
  }

  // Tolerate clients that send internal/UI-only keys (older builds echoed the
  // whole GET payload): drop them instead of rejecting the entire save.
  const updates: Record<string, string> = {};
  const ignored: string[] = [];
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!isAllowedSettingKey(key)) {
      ignored.push(key);
      continue;
    }
    updates[key] = value as string;
  }
  if (ignored.length > 0) {
    logger.warn(`[settings] ignorando claves no editables: ${ignored.join(", ")}`);
  }

  const v = validateBody(updateSettingsSchema, updates);
  if (!v.success) return v.response;

  try {
    const result = settingsService.updateSettings(v.data);
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

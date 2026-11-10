import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { testConnection as testResend } from "@/lib/resend-client";
import { testSmtp } from "@/lib/smtp-client";
import { testImap } from "@/lib/cron/email-replies";
import { getWhatsAppStatus } from "@/lib/whatsapp-client";
import { getApiKey, getSetting, getGmapsScraperUrl } from "@/db";

export async function GET() {
  const results: Record<string, { ok: boolean; error?: string }> = {};

  // Test Gemini
  try {
    const genAI = new GoogleGenerativeAI(getApiKey("gemini_api_key", "GEMINI_API_KEY"));
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    await model.generateContent("Responde solo: OK");
    results.gemini = { ok: true };
  } catch (err) {
    results.gemini = { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
  }

  // Test Anthropic (only when a key is configured)
  const anthropicKey = getApiKey("anthropic_api_key", "ANTHROPIC_API_KEY");
  if (anthropicKey) {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 8,
        messages: [{ role: "user", content: "Responde solo: OK" }],
      });
      results.anthropic = { ok: true };
    } catch (err) {
      results.anthropic = { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  // Test Mistral (only when a key is configured)
  const mistralKey = getApiKey("mistral_api_key", "MISTRAL_API_KEY");
  if (mistralKey) {
    try {
      await generateText({
        model: createMistral({ apiKey: mistralKey })("mistral-small-latest"),
        prompt: "Reply with OK",
        maxOutputTokens: 8,
      });
      results.mistral = { ok: true };
    } catch (err) {
      results.mistral = { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  // Test OpenAI (only when a key is configured)
  const openaiKey = getApiKey("openai_api_key", "OPENAI_API_KEY");
  if (openaiKey) {
    try {
      await generateText({
        model: createOpenAI({ apiKey: openaiKey })(
          process.env.OPENAI_MODEL || "gpt-4.1-mini"
        ),
        prompt: "Reply with OK",
        maxOutputTokens: 16,
      });
      results.openai = { ok: true };
    } catch (err) {
      results.openai = { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  // Test the active email sender
  if (getSetting("email_provider") === "smtp" || getSetting("smtp_host")) {
    const smtpResult = await testSmtp();
    results.smtp = { ok: smtpResult.success, error: smtpResult.error };
  }
  if (getSetting("email_provider") !== "smtp") {
    const resendResult = await testResend();
    results.resend = { ok: resendResult.success, error: resendResult.error };
  }

  // Test IMAP (reply capture) when enabled/configured
  if (getSetting("imap_enabled") === "true" || getSetting("imap_host")) {
    const imapResult = await testImap();
    results.imap = { ok: imapResult.success, error: imapResult.error };
  }

  // Test the Google Maps scraper. The self-hosted gosom image has no auth, so
  // this call deliberately sends no API key — it verifies the URL is reachable
  // from the app container (the most common deployment mistake).
  const scraperUrl = getGmapsScraperUrl();
  try {
    const scraperRes = await fetch(`${scraperUrl}/api/v1/jobs`, {
      signal: AbortSignal.timeout(5000),
    });
    results.scraper = scraperRes.ok
      ? { ok: true }
      : { ok: false, error: `HTTP ${scraperRes.status} at ${scraperUrl}` };
  } catch (err) {
    results.scraper = {
      ok: false,
      error: `${err instanceof Error ? err.message : "Unreachable"} (${scraperUrl})`,
    };
  }

  // Test WhatsApp
  const waStatus = getWhatsAppStatus();
  results.whatsapp = {
    ok: waStatus.status === "ready",
    error: waStatus.status !== "ready" ? (waStatus.error || `Estado: ${waStatus.status}`) : undefined,
  };

  // Test Python/Scrapling
  try {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const exec = promisify(execFile);
    const pythonCmd = process.env.PYTHON_PATH || "python3";
    await exec(pythonCmd, ["-c", "import scrapling; print('OK')"], { timeout: 10000 });
    results.scrapling = { ok: true };
  } catch (err) {
    results.scrapling = { ok: false, error: err instanceof Error ? err.message : "Not available" };
  }

  return NextResponse.json(results);
}

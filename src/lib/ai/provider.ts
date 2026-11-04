import Anthropic from "@anthropic-ai/sdk";
import { createMistral } from "@ai-sdk/mistral";
import { generateText } from "ai";
import { getSetting, getApiKey } from "@/db";
import { getGenAI, cleanJsonResponse, safeParseJSON } from "./config";
import { runClaudeCli } from "./claude-cli";
import { geminiRateLimiter, mistralRateLimiter } from "@/lib/ai/rate-limiter";

/**
 * AI engine selected in Settings → Connections. A single provider governs all
 * structured generation (copy + website analysis) and the chatbot.
 *
 * - `claude_cli`: local `claude -p` CLI (Max plan, no API cost). Default.
 * - `gemini`:     Google Gemini API key.
 * - `anthropic`:  Anthropic API key (Messages API).
 * - `mistral`:    Mistral AI API key (via the Vercel AI SDK provider).
 */
export type AiProvider = "claude_cli" | "gemini" | "anthropic" | "mistral";

export function getAiProvider(): AiProvider {
  const v = getSetting("ai_provider");
  return v === "gemini" || v === "anthropic" || v === "mistral" ? v : "claude_cli";
}

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const GEMINI_MODEL = "gemini-2.5-flash";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-large-latest";

// System prompt for the API providers (Anthropic/Gemini/Mistral). For `claude_cli` the
// CLI's own default copywriting-neutral system prompt is used unless overridden.
const STRUCTURED_SYSTEM_PROMPT =
  "Eres un asistente experto en copywriting B2B. Sigue las instrucciones del usuario al pie de la letra " +
  "y responde únicamente con el objeto solicitado, sin texto adicional, sin comentarios y sin markdown.";

// Lazily build and cache the Anthropic client, re-creating it when the resolved
// API key changes so keys edited in the app take effect without a restart.
let _anthropic: Anthropic | null = null;
let _anthropicKey = "";
function getAnthropic(): Anthropic {
  const key = getApiKey("anthropic_api_key", "ANTHROPIC_API_KEY");
  if (!key) throw new Error("Anthropic API key no configurada (ai_provider=anthropic)");
  if (!_anthropic || key !== _anthropicKey) {
    _anthropic = new Anthropic({ apiKey: key });
    _anthropicKey = key;
  }
  return _anthropic;
}

// Lazily build and cache the Mistral provider, re-created when the resolved key
// changes so keys edited in the app take effect without a restart.
let _mistral: ReturnType<typeof createMistral> | null = null;
let _mistralKey = "";
function getMistral(): ReturnType<typeof createMistral> {
  const key = getApiKey("mistral_api_key", "MISTRAL_API_KEY");
  if (!key) throw new Error("Mistral API key no configurada (ai_provider=mistral)");
  if (!_mistral || key !== _mistralKey) {
    _mistral = createMistral({ apiKey: key });
    _mistralKey = key;
  }
  return _mistral;
}

export interface GenerateStructuredOptions {
  /** User prompt. */
  prompt: string;
  /** Overrides the default system prompt. */
  systemPrompt?: string;
  /** JSON Schema the response must match. */
  jsonSchema: object;
  /** Label for logs / errors. */
  label?: string;
  /** Max output tokens for the API providers. Default 4096. */
  maxTokens?: number;
  /**
   * Override the model for this single call. For `claude_cli` it's the `--model`
   * value (e.g. "claude-opus-4-8"); for `anthropic`/`gemini`/`mistral` it
   * overrides their default. When unset, each provider uses its configured default.
   */
  model?: string;
}

/**
 * Provider-agnostic structured generation. Returns the parsed object matching
 * `jsonSchema`. Dispatches to the engine selected by `ai_provider`.
 */
export async function generateStructured<T>(opts: GenerateStructuredOptions): Promise<T> {
  const { prompt, jsonSchema, label = "generate", maxTokens = 4096 } = opts;
  const provider = getAiProvider();

  if (provider === "claude_cli") {
    return (await runClaudeCli({ prompt, jsonSchema, systemPrompt: opts.systemPrompt, label, model: opts.model })) as T;
  }

  if (provider === "anthropic") {
    const client = getAnthropic();
    const res = await client.messages.create({
      model: opts.model ?? ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: opts.systemPrompt ?? STRUCTURED_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      // Structured outputs: the API guarantees the first text block is valid JSON
      // matching the schema. See claude-api skill / structured-outputs docs.
      output_config: { format: { type: "json_schema", schema: jsonSchema as Record<string, unknown> } },
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error(`${label}: Anthropic devolvió una respuesta sin texto (stop_reason=${res.stop_reason})`);
    }
    return safeParseJSON<T>(block.text, label);
  }

  if (provider === "mistral") {
    await mistralRateLimiter.acquire();
    const { text } = await generateText({
      model: getMistral()(opts.model ?? MISTRAL_MODEL),
      system: opts.systemPrompt ?? STRUCTURED_SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: maxTokens,
    });
    return safeParseJSON<T>(cleanJsonResponse(text.trim()), label);
  }

  // gemini
  await geminiRateLimiter.acquire();
  const model = getGenAI().getGenerativeModel({
    model: opts.model ?? GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  return safeParseJSON<T>(cleanJsonResponse(raw), label);
}
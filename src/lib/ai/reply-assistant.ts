import { generateStructured } from "./provider";
import { withRetry } from "@/lib/ai/retry";
import { logger } from "@/lib/logger";
import { GEMINI_MAX_RETRIES, GEMINI_BASE_DELAY_MS } from "@/lib/constants";
import { getAgencyContext, formatAgencyContextBlock, getLocaleLabel, getLocaleWritingRules } from "./config";
import { fenced } from "./fence";
import { ANTI_AI_RULES } from "./examples";
import { getLeadConversation, formatConversation } from "@/lib/conversation";

// Replies use Opus 4.8 (subscription via claude_cli) like the Workana drafter.
const REPLY_MODEL = process.env.REPLY_DRAFT_MODEL || "claude-opus-4-8";

const REPLY_SYSTEM =
  "You are the real person who does the work at an agency and answers a prospect who replied to your message. " +
  "You write naturally and directly, like a real person, never like an AI nor with templates. You don't invent cases, " +
  "data, prices or results. PROHIBITED to use em-dash or long dash (the character —): use comma, period, colon or " +
  "parentheses. You never share contact info outside the channel. Answer only with the requested object.";

const REPLY_SCHEMA = {
  type: "object",
  properties: { reply: { type: "string" } },
  required: ["reply"],
  additionalProperties: false,
} as const;

export interface DraftReplyInput {
  leadId: number;
  channel: "email" | "whatsapp";
  /** The inbound message we're answering (treated strictly as untrusted data). */
  latestInboundText: string;
  agencyProfileId?: number | null;
  leadName?: string | null;
  leadCategory?: string | null;
  leadCountry?: string | null;
  fromName?: string | null;
  /** Optional user steer for a regenerate (e.g. "shorter", "offer a call"). */
  instructions?: string;
}

/**
 * Draft a suggested reply to a prospect, using the full prior conversation plus the
 * enriched agency knowledge base. Never auto-sent — the user reviews/edits/approves.
 * The inbound message is fenced as untrusted data (prompt-injection guard).
 */
export async function draftConversationReply(input: DraftReplyInput): Promise<string | null> {
  const text = (input.latestInboundText || "").trim();
  if (!text) return null;

  const ctx = getAgencyContext(input.agencyProfileId);
  const country = input.leadCountry || ctx.country;
  const localeLabel = getLocaleLabel(country);
  const writingRules = getLocaleWritingRules(country);
  const fromName = input.fromName || ctx.ownerName || ctx.name;

  const turns = getLeadConversation(input.leadId);
  const thread = formatConversation(turns, fromName || "Us", input.leadName || "Client");
  const relevanceHint = [input.leadCategory, text].filter(Boolean).join(" ");

  const channelRules =
    input.channel === "whatsapp"
      ? [
          "This is a WhatsApp reply: maximum 500 characters, conversational, single bubble.",
          "ZERO links, URLs, domains. ZERO or max 1 emoji.",
        ]
      : [
          "This is an email reply: brief greeting + clear body. Do not write a subject (it is reused from the thread).",
          "Concise (80-160 words). No signature or legal footer (they are injected separately).",
        ];

  const prompt = [
    "PROFILE (answer as this profile, in first person, like a real person):",
    formatAgencyContextBlock(ctx, { relevanceHint, maxProjects: input.channel === "whatsapp" ? 2 : 4 }),
    "",
    `The person writing is called ${fromName}${ctx.name ? `, from ${ctx.name}` : ""}.`,
    thread ? `CONVERSATION SO FAR (oldest to most recent):\n${thread}` : "",
    "",
    fenced("LAST MESSAGE FROM THE PROSPECT (the one you're answering)", text.slice(0, 1500)),
    "",
    ANTI_AI_RULES,
    "",
    `Response language: ${localeLabel}.`,
    ...channelRules,
    "Answer in a useful and human way: address what they ask or raise and move the conversation forward with a concrete next step.",
    "If there is a portfolio project in the context that fits, use it as a short and concrete proof, without inventing or exaggerating it.",
    "Never invent prices or timelines you don't know; if you don't know them, propose to discuss them. Never include contact info outside the channel.",
    ...(input.instructions ? ["", `USER ADJUSTMENT REQUEST (respect it while keeping it natural): ${input.instructions.trim()}`] : []),
    writingRules,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await withRetry(
      () =>
        generateStructured<{ reply: string }>({
          prompt,
          systemPrompt: REPLY_SYSTEM,
          jsonSchema: REPLY_SCHEMA,
          label: "reply-assistant",
          model: REPLY_MODEL,
          maxTokens: 700,
        }),
      { maxRetries: GEMINI_MAX_RETRIES, baseDelayMs: GEMINI_BASE_DELAY_MS, label: "reply-assistant" },
    );
    return res.reply?.trim() || null;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "reply-assistant: draftConversationReply failed");
    return null;
  }
}

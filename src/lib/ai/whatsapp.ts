import { getAgencyContext, getLocaleLabel, getLocaleWritingRules, SERVICE_DEFINITIONS, formatAgencyContextBlock } from "./config";
import { generateStructured } from "./provider";
import { withRetry } from "@/lib/ai/retry";
import { sanitizeIssues } from "@/lib/lead-quality";
import { GEMINI_MAX_RETRIES, GEMINI_BASE_DELAY_MS } from "@/lib/constants";
import {
  formatWhatsAppExamples,
  ANTI_AI_RULES,
  PERSONA_BLOCK,
  SELF_CHECK_WHATSAPP,
  type CopyPurpose,
} from "./examples";
import type { WebAnalysis, WhatsAppGeneration } from "./types";

const WHATSAPP_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
  additionalProperties: false,
} as const;

export async function generateWhatsApp(
  businessName: string,
  businessCategory: string | null,
  city: string | null,
  websiteUrl: string | null,
  analysis: WebAnalysis | null,
  tone: string,
  fromName: string,
  sequenceStep?: number,
  customInstructions?: string,
  leadCountry?: string,
  agencyProfileId?: number | null
): Promise<WhatsAppGeneration> {
  const ctx = getAgencyContext(agencyProfileId);
  const effectiveCountry = leadCountry || ctx.country;
  const localeLabel = getLocaleLabel(effectiveCountry);
  const writingRules = getLocaleWritingRules(effectiveCountry);

  const purpose: CopyPurpose = !sequenceStep || sequenceStep === 1 ? "initial" : "follow_up";

  const analysisContext = analysis
    ? `\nDIGITAL PRESENCE ANALYSIS:
- Score web: ${analysis.qualityScore}/100
- Score SEO: ${analysis.seoScore ?? "N/A"}/100
- Issues: ${sanitizeIssues(analysis.issues).join(", ")}
- SEO opportunities: ${sanitizeIssues(analysis.seoIssues).join(", ")}
- AI opportunities: ${(analysis.aiAgentOpportunities || []).join(", ")}
- Recommended services: ${(analysis.recommendedServices || []).map((k) => SERVICE_DEFINITIONS[k]?.label || k).join(", ")}
- Summary: ${analysis.summary}`
    : "\nThe website has not been analyzed or they have none.";

  const stepContext = sequenceStep && sequenceStep > 1
    ? `\nTHIS IS FOLLOW-UP #${sequenceStep - 1}. You already contacted them before. Be shorter and more direct. Change the angle. You can reference that you wrote before ("I wrote to you a few days ago…").`
    : "";

  const extraInstructions = customInstructions ? `\nADDITIONAL INSTRUCTIONS FROM THE USER: ${customInstructions}` : "";

  const examplesBlock = formatWhatsAppExamples(purpose, 3);

  const prompt = `${PERSONA_BLOCK(fromName, ctx.name)}

OBSERVATION FOR THE AGENCY THAT WRITES (identity and services; DO NOT invent data that is not here):
${formatAgencyContextBlock(ctx, { identityOnly: true })}

BUSINESS DATA YOU'RE WRITING TO:
- Name: ${businessName}
- Category: ${businessCategory || "Not specified"}
- City: ${city || "Not specified"}
- Current web: ${websiteUrl || "None"}
${analysisContext}

REQUESTED TONE: ${tone}
${stepContext}
${extraInstructions}

GOAL OF THE MESSAGE:
The recipient should feel they GAIN something by responding. DO NOT audit them or point out flaws: show how they can have MORE CLIENTS or MORE SALES. Every technical problem you mention must translate to tangible business impact.

STRUCTURE OF THE MESSAGE (in a single bubble, no splits):
1. GREETING + IDENTIFICATION (1 short line): "Hi [name], I'm [your name] from [agency]".
2. CONCRETE OBSERVATION (1-2 lines): something TRUE and specific about their business (from the audit) tied to clients or sales. NO vague praise or filler ("it looks like they've been at it a while", "they have a great service"): it sounds hollow and insincere. If there is nothing specific, go straight to the useful point.
3. PROPOSAL / PERMISSION ASK (1 line): what you offer or what you ask permission to send, concrete and low-commitment. DO NOT mention projects or clients they don't know, NOR present your agency or its size/products ("we're a directory with X doctors"): in a first message it sounds like bragging and is filler.
4. OPEN QUESTION (at the end of the same block): "interested?", "you in?", "does it make sense?".

WHATSAPP B2B RULES:
1. LANGUAGE: ${localeLabel}
2. MAX 300 characters. WhatsApp is conversational, not formal.
3. One single bubble, NEVER splits into consecutive messages (looks like mass spam).
4. ZERO links, URLs, domains. They trigger spam filters and blocking of the number.
5. ZERO or MAX 1 emoji. Better 0 in B2B unless specified.
6. DO NOT use technical jargon without explaining the impact. Nothing like "SSL", "responsive", "SEO" alone.
7. NEVER say "I'm ${ctx.name}". You are "${fromName}, from ${ctx.name}".
8. NEVER ask for a direct meeting, call or calendar in cold #1. Close with an open question.
9. NEVER use "free", "no commitment", "free audit". Natural alternatives: "send you an analysis", "teach you how", "tell you in two lines".

${ANTI_AI_RULES}

REGIONAL ADAPTATION (CRITICAL):
The business is in ${city || "location not specified"}. Adapt to the country of THAT city, NOT the agency. If in Mexico, Mexican Spanish (no "vosotros", no "tío", no "okay"). If in Argentina, voseo. If in Spain, Spanish from Spain.
${writingRules}

EXAMPLES OF THE STYLE WE WANT (required tone reference, not literal copies):
${examplesBlock}

${SELF_CHECK_WHATSAPP}`;

  return withRetry(
    () => generateStructured<WhatsAppGeneration>({ prompt, jsonSchema: WHATSAPP_SCHEMA, label: "generate-whatsapp" }),
    { maxRetries: GEMINI_MAX_RETRIES, baseDelayMs: GEMINI_BASE_DELAY_MS, label: "generate-whatsapp" },
  );
}

export async function regenerateWhatsApp(
  businessName: string,
  businessCategory: string | null,
  city: string | null,
  websiteUrl: string | null,
  analysis: WebAnalysis | null,
  tone: string,
  fromName: string,
  previousMessage: string,
  instructions: string,
  leadCountry?: string,
  agencyProfileId?: number | null
): Promise<WhatsAppGeneration> {
  const ctx = getAgencyContext(agencyProfileId);
  const effectiveCountry = leadCountry || ctx.country;
  const localeLabel = getLocaleLabel(effectiveCountry);
  const writingRules = getLocaleWritingRules(effectiveCountry);

  const examplesBlock = formatWhatsAppExamples("initial", 3);

  const prompt = `${PERSONA_BLOCK(fromName, ctx.name)}

You need to REGENERATE a WhatsApp outreach message you already wrote, applying a new tone or instructions.

OBSERVATION FOR THE AGENCY THAT WRITES (identity and services; DO NOT invent data that is not here):
${formatAgencyContextBlock(ctx, { identityOnly: true })}

BUSINESS DATA:
- Name: ${businessName}
- Category: ${businessCategory || "Not specified"}
- City: ${city || "Not specified"}
- Web: ${websiteUrl || "None"}

PREVIOUS MESSAGE:
${previousMessage}

NEW TONE: ${tone}
ADDITIONAL INSTRUCTIONS: ${instructions || "Just change the tone"}
LANGUAGE: ${localeLabel}

RULES:
- MAX 300 characters, conversational, no HTML, no links/URLs/domains.
- MAX 1 emoji (better 0).
- Focus on what the recipient GAINS (more clients, more sales), NOT on listing technical problems.
- Every problem → business impact.
- NEVER use "free", "no commitment", "free audit".
- NEVER use technical jargon without explaining.
- NEVER ask for a meeting/call/calendar directly. Close with an open question like "interested?".
- You can talk about web, SEO, AI, Google Business or social media depending on what is most relevant.

${ANTI_AI_RULES}

REGIONAL ADAPTATION (CRITICAL):
The business is in ${city || "location not specified"}. Adapt to the country of THAT city. If in Mexico, Mexican Spanish. If in Argentina, voseo. If in Spain, Spanish from Spain.
${writingRules}

EXAMPLES OF THE STYLE WE WANT (don't copy literally, capture the tone):
${examplesBlock}

${SELF_CHECK_WHATSAPP}`;

  return withRetry(
    () => generateStructured<WhatsAppGeneration>({ prompt, jsonSchema: WHATSAPP_SCHEMA, label: "regenerate-whatsapp" }),
    { maxRetries: GEMINI_MAX_RETRIES, baseDelayMs: GEMINI_BASE_DELAY_MS, label: "regenerate-whatsapp" },
  );
}

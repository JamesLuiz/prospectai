import { getAgencyContext, getLocaleLabel, getLocaleWritingRules } from "./config";
import { generateStructured } from "./provider";
import { withRetry } from "@/lib/ai/retry";
import { GEMINI_MAX_RETRIES, GEMINI_BASE_DELAY_MS } from "@/lib/constants";
import {
  ANTI_AI_RULES,
  PERSONA_BLOCK,
  SELF_CHECK_EMAIL,
  SELF_CHECK_WHATSAPP,
} from "./examples";
import type { TemplateGeneration, WhatsAppTemplateGeneration } from "./types";

const EMAIL_TEMPLATE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    subject: { type: "string" },
    bodyHtml: { type: "string" },
    bodyText: { type: "string" },
    variables: { type: "array", items: { type: "string" } },
  },
  required: ["name", "subject", "bodyHtml", "bodyText", "variables"],
  additionalProperties: false,
} as const;

const WHATSAPP_TEMPLATE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    message: { type: "string" },
    variables: { type: "array", items: { type: "string" } },
  },
  required: ["name", "message", "variables"],
  additionalProperties: false,
} as const;

export async function generateEmailTemplate(
  industry: string,
  purpose: "initial" | "follow_up" | "breakup",
  tone: string,
  customInstructions?: string
): Promise<TemplateGeneration> {
  const ctx = getAgencyContext();
  const localeLabel = getLocaleLabel(ctx.country);
  const writingRules = getLocaleWritingRules(ctx.country);
  const servicesDesc = ctx.services.map((s) => `- ${s.label}: ${s.description}`).join("\n");

  const purposeMap = {
    initial: "First contact, cold outreach email initial",
    follow_up: "Follow-up, second or third contact, different angle, shorter",
    breakup: "Breakup, last message of the sequence, cordial goodbye",
  };

  const wordLimits = {
    initial: 110,
    follow_up: 75,
    breakup: 60,
  };

  const wordLabels = {
    initial: "75-110 words",
    follow_up: "50-75 words",
    breakup: "40-60 words",
  };

  const prompt = `${PERSONA_BLOCK("[the sender]", ctx.name)}

Your job here: GENERATE A REUSABLE email TEMPLATE for the "${industry}" industry. The template must use {{placeholder}} variables and later be filled in for each concrete lead.

PURPOSE: ${purposeMap[purpose]}
LANGUAGE: ${localeLabel}
${customInstructions ? `ADDITIONAL INSTRUCTIONS: ${customInstructions}` : ""}

AGENCY SERVICES:
${servicesDesc}

CORE PRINCIPLE — BENEFIT-FOCUSED APPROACH:
The recipient doesn't care about technical problems. They care about MORE CLIENTS and MORE SALES. Every problem must be translated into business impact:
- "No SSL" → "Visitors see 'not secure' and go to the competition"
- "Not responsive" → "The 70% search from mobile and can't navigate the web well"
- "Low SEO" → "When someone searches {{category}} in {{city}}, the competition shows up and they don't"
- "No web" → "The clients who search on Google don't find them"

TEMPLATE RULES:
1. LENGTH: ${wordLabels[purpose]} in the body. It's a ceiling, not a goal.
2. FORMAT: plain text with minimal HTML (<p>, <br>, <b>). NOTHING of images, colors or HTML headers.
3. SUBJECT: 4-7 words, lowercase, that sparks curiosity about the BENEFIT. Example: "more clients for {{business_name}}". NOT: "problems with your web".
4. SINGLE CTA: soft question oriented to the benefit. NEVER "Book a demo" or "Schedule a call".
5. STRUCTURE (4 short blocks):
   - SPECIFIC OPENING: 1-2 sentences with a concrete observation using variables.
   - PROBLEM BRIDGE: 1-2 sentences connecting with clients/sales that lose or can capture.
   - VALUE: 1 sentence about how you help similar businesses. Without promising exact figures.
   - CTA: 1 sentence, open question about the benefit.
6. SIGNATURE: only "{{sender_name}}, de ${ctx.name}". NEVER "I am ${ctx.name}". Do not add legal footer or unsubscribe text (the system injects it).
7. FOR FOLLOW-UP: change angle relative to the initial. If the initial talks about web, the follow-up talks about SEO or AI. Shorter.
8. FOR BREAKUP: cordial goodbye, leave the door open, no guilt or pressure.
9. LEGAL COMPLIANCE: the email must identify itself as a commercial communication. Clear sender.

${ANTI_AI_RULES}

REGIONAL ADAPTATION:
The template will use the {{city}} variable for personalization. Adapt to the locale language: ${localeLabel}. Write naturally for that market.
${writingRules}

AVAILABLE VARIABLES in the template:
- {{business_name}}: business name
- {{category}}: category/industry
- {{city}}: city
- {{website}}: business website
- {{issue}}: specific issue detected
- {{sender_name}}: sender name
- {{service}}: recommended service

${SELF_CHECK_EMAIL(wordLimits[purpose])}

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "name": "short descriptive template name",
  "subject": "email subject with {{variables}} if applicable",
  "bodyHtml": "email body in minimal HTML (<p>, <b>, <br>)",
  "bodyText": "plain text version of the email",
  "variables": ["list", "of", "variables", "used"]
}`;

  return withRetry(
    () => generateStructured<TemplateGeneration>({ prompt, jsonSchema: EMAIL_TEMPLATE_SCHEMA, label: "generate-email-template" }),
    { maxRetries: GEMINI_MAX_RETRIES, baseDelayMs: GEMINI_BASE_DELAY_MS, label: "generate-email-template" },
  );
}

export async function generateWhatsAppTemplate(
  industry: string,
  purpose: "initial" | "follow_up" | "breakup",
  tone: string,
  customInstructions?: string
): Promise<WhatsAppTemplateGeneration> {
  const ctx = getAgencyContext();
  const localeLabel = getLocaleLabel(ctx.country);
  const writingRules = getLocaleWritingRules(ctx.country);
  const servicesDesc = ctx.services.map((s) => `- ${s.label}: ${s.description}`).join("\n");

  const purposeMap = {
    initial: "First contact, initial outreach WhatsApp message",
    follow_up: "Follow-up, second contact, different angle, shorter",
    breakup: "Breakup, last message, cordial goodbye",
  };

  const prompt = `${PERSONA_BLOCK("[the sender]", ctx.name)}

Your job here: GENERATE A REUSABLE WhatsApp TEMPLATE for the "${industry}" industry. The template must use {{placeholder}} variables and later be filled in for each concrete lead.

PURPOSE: ${purposeMap[purpose]}
LANGUAGE: ${localeLabel}
${customInstructions ? `ADDITIONAL INSTRUCTIONS: ${customInstructions}` : ""}

AGENCY SERVICES:
${servicesDesc}

CORE PRINCIPLE — BENEFIT-FOCUSED APPROACH:
The recipient should feel they gain something by responding. You're not auditing them or pointing out flaws: you're showing how they can have MORE CLIENTS or MORE SALES. Every technical problem → business impact:
- "No web" → "the clients who search on Google don't find them, they go to the competition"
- "Slow/bad web" → "people land, don't load well and leave"
- "No social" → "the competition is capturing your potential customers there"

WHATSAPP TEMPLATE RULES:
1. MAX 300 characters. One bubble. WhatsApp is conversational, not formal.
2. Brief natural greeting ("Hi {{contact_name}},") + quick identification ("I'm {{sender_name}} from ${ctx.name}").
3. One concrete observation using variables ({{business_name}}, {{city}}, {{issue}}) translated to business impact.
4. Close with an open question like "interested?", "you in?", "does it make sense?". NEVER ask for a meeting/calendar directly.
5. ZERO links, URLs or domains. They trigger spam filters and blocking.
6. ZERO emojis or at most 1 if the tone allows. Better 0.
7. Do not use technical jargon without explaining the impact.
8. NEVER "I'm ${ctx.name}" — you are "{{sender_name}}, de ${ctx.name}".
9. FOR FOLLOW-UP: reference the previous message. Shorter. Change the angle.
10. FOR BREAKUP: cordial, no pressure, leave the door open.
11. ANTI-BLOCK: repetitive or too-commercial messages generate reports and number blocking. Naturalness above all.

${ANTI_AI_RULES}

REGIONAL ADAPTATION:
The template will use the {{city}} variable for personalization. Adapt to the locale language: ${localeLabel}. Write naturally for that market.
${writingRules}

AVAILABLE VARIABLES:
- {{business_name}}: business name
- {{category}}: category/industry
- {{city}}: city
- {{contact_name}}: contact name
- {{issue}}: detected issue
- {{sender_name}}: sender name
- {{service}}: recommended service

${SELF_CHECK_WHATSAPP}

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "name": "short descriptive template name",
  "message": "the WhatsApp message with {{variables}}",
  "variables": ["list", "of", "variables", "used"]
}`;

  return withRetry(
    () => generateStructured<WhatsAppTemplateGeneration>({ prompt, jsonSchema: WHATSAPP_TEMPLATE_SCHEMA, label: "generate-whatsapp-template" }),
    { maxRetries: GEMINI_MAX_RETRIES, baseDelayMs: GEMINI_BASE_DELAY_MS, label: "generate-whatsapp-template" },
  );
}

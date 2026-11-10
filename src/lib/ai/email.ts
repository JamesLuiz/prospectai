import { getAgencyContext, getLocaleLabel, getLocaleWritingRules, formatAgencyContextBlock } from "./config";
import { generateStructured } from "./provider";
import { withRetry } from "@/lib/ai/retry";
import { sanitizeIssues } from "@/lib/lead-quality";
import { GEMINI_MAX_RETRIES, GEMINI_BASE_DELAY_MS } from "@/lib/constants";
import {
  formatEmailExamples,
  ANTI_AI_RULES,
  PERSONA_BLOCK,
  SELF_CHECK_EMAIL,
  type CopyPurpose,
} from "./examples";
import type { EmailGeneration, WebAnalysis } from "./types";

const EMAIL_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    bodyHtml: { type: "string" },
    bodyText: { type: "string" },
  },
  required: ["subject", "bodyHtml", "bodyText"],
  additionalProperties: false,
} as const;

export async function generateEmail(
  businessName: string,
  businessCategory: string | null,
  city: string | null,
  websiteUrl: string | null,
  analysis: WebAnalysis,
  tone: string,
  fromName: string,
  sequenceStep?: number,
  customInstructions?: string,
  leadCountry?: string,
  agencyProfileId?: number | null
): Promise<EmailGeneration> {
  const ctx = getAgencyContext(agencyProfileId);
  const effectiveCountry = leadCountry || ctx.country;
  const localeLabel = getLocaleLabel(effectiveCountry);
  const writingRules = getLocaleWritingRules(effectiveCountry);

  const purpose: CopyPurpose = !sequenceStep || sequenceStep === 1 ? "initial" : "follow_up";
  const maxWords = purpose === "initial" ? 90 : 60;

  // Build service-specific pitch based on analysis
  const recommendedServices = (analysis.recommendedServices || ["web_development"])
    .map((key) => ctx.services.find((s) => s.key === key))
    .filter(Boolean)
    .map((s) => `- ${s!.label}: ${s!.description}`)
    .join("\n");

  // Build issue context from all analysis angles. sanitizeIssues strips any
  // unverifiable "site is broken/cut off/incomplete" claim — including from
  // analyses stored BEFORE the anti-hallucination fix (read straight from
  // leads.analysisJson here), so old leads never leak the lie into new copy.
  const webIssues = sanitizeIssues(analysis.issues);
  const seoIssues = sanitizeIssues(analysis.seoIssues);
  const issueContext: string[] = [];
  if (webIssues.length > 0) issueContext.push(`Web issues: ${webIssues.join(", ")}`);
  if (seoIssues.length > 0) issueContext.push(`SEO issues: ${seoIssues.join(", ")}`);
  if (analysis.googleBusinessOpportunities?.length > 0) issueContext.push(`Google Business opportunities: ${analysis.googleBusinessOpportunities.join(", ")}`);
  if (analysis.aiAgentOpportunities?.length > 0) issueContext.push(`AI opportunities: ${analysis.aiAgentOpportunities.join(", ")}`);

  const stepContext = sequenceStep && sequenceStep > 1
    ? `\nTHIS IS FOLLOW-UP #${sequenceStep - 1}. The business already got ${sequenceStep - 1} message(s) before. DO NOT repeat what you probably already told them. Change the angle: if the first message touched on web, now talk about SEO or AI. Be shorter and more direct. You can reference that you already wrote ("I wrote to you last week…").`
    : "";

  const extraInstructions = customInstructions ? `\nADDITIONAL INSTRUCTIONS FROM THE USER: ${customInstructions}` : "";

  const examplesBlock = formatEmailExamples(purpose, 3);

  const prompt = `${PERSONA_BLOCK(fromName, ctx.name)}

AGENCY CONTEXT (identity and services; DO NOT invent data that is not here):
${formatAgencyContextBlock(ctx, { identityOnly: true })}

BUSINESS DATA YOU'RE WRITING TO:
- Name: ${businessName}
- Category: ${businessCategory || "Not specified"}
- City: ${city || "Not specified"}
- Current web: ${websiteUrl || "None"}

DIGITAL PRESENCE ANALYSIS:
- Web score: ${analysis.qualityScore}/100
- SEO score: ${analysis.seoScore ?? "N/A"}/100
${issueContext.map((i) => `- ${i}`).join("\n")}
- Summary: ${analysis.summary}

RELEVANT SERVICES FOR THIS BUSINESS:
${recommendedServices}

REQUESTED TONE: ${tone}
${stepContext}
${extraInstructions}

CORE PRINCIPLE — COLD EMAIL, SHORT AND RELEVANT:
The person doesn't know you and gives you 5 seconds. The shorter and more specific, the better. DO NOT mention projects, clients or concrete cases the recipient doesn't know, and DO NOT present your agency or its size, products or track record (nothing like "we're a directory with X doctors", "we work with Y", "we've been doing this for years"): all of that is filler the reader doesn't care about in a first message. Your agency only shows up when signing and, if needed, in "I'm [name], from [agency]". ALL personalization comes from what you OBSERVE in THIS business's audit, nothing more.

BENEFIT FOCUS: the recipient cares about MORE CLIENTS and MORE SALES, not technical jargon. ALWAYS translate what you observed into business impact:
- "No SSL" → "they see 'not secure' and go to the competition"
- "Not responsive" → "most come in from mobile and can't navigate well"
- "Low SEO" → "when someone searches [their category] in [their city], the competition shows up and they don't"
- "No web" → "whoever searches for them on Google can't find them"

STRUCTURE (3 short blocks, no filler):
1. OPENING = the concrete observation from the audit (1 sentence). Direct about something TRUE and specific to THIS business. PROHIBITED to open with vague filler praise ("it looks like they have a track record", "it looks like they've been caring for years", "they have a great service"): it sounds hollow and insincere. If you don't have a specific, honest observation, open directly with the useful point, no praise.
2. IMPACT (1-2 sentences): what clients or sales are lost because of it and, in one sentence, how you solve it. One single idea, no listing of jargon.
3. SOFT CTA (1 sentence): open question or interest check. NEVER ask for a meeting, call or calendar in the first email.

LENGTH: body of 40 to ${maxWords} words, NEVER more. The shorter, the better (50-70 ideal). If you exceed it, cut down to comply. Maximum 3 short paragraphs.

SUBJECT: 4-7 words, lowercase (sentence case), that sparks curiosity about the BENEFIT or references something specific about the business. NO caps, NO exclamation marks, NO spam words.

${ANTI_AI_RULES}

ADDITIONAL RULES:
1. LANGUAGE: ${localeLabel}
2. Present yourself as "${fromName}, from ${ctx.name}" if needed. NEVER say "I'm ${ctx.name}" nor present yourself as if you were the company itself.
3. DO NOT use technical jargon without translating it into business impact (not "SSL", "responsive", "SEO", "meta tags" alone).
4. Do not add legal footer or unsubscribe text; the system injects it automatically.
5. Sign off with just the name (no title, no URL).

REGIONAL ADAPTATION (CRITICAL):
The business is in ${city || "location not specified"}. Adapt the language to the country of THAT city, NOT the agency. If the city is in Mexico, Mexican Spanish. If in Argentina, voseo. If in Spain, Spanish from Spain. This is MANDATORY.
${writingRules}

EXAMPLES OF THE STYLE WE WANT (reference tone, don't copy literally):
${examplesBlock}

${SELF_CHECK_EMAIL(maxWords)}

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "subject": "email subject",
  "bodyHtml": "email body in minimal HTML (<p>, <b>, <br>, <a>)",
  "bodyText": "plain text version of the email"
}`;

  return withRetry(
    () => generateStructured<EmailGeneration>({ prompt, jsonSchema: EMAIL_SCHEMA, label: "generate-email" }),
    { maxRetries: GEMINI_MAX_RETRIES, baseDelayMs: GEMINI_BASE_DELAY_MS, label: "generate-email" },
  );
}

export async function regenerateEmail(
  businessName: string,
  businessCategory: string | null,
  city: string | null,
  websiteUrl: string | null,
  analysis: WebAnalysis,
  tone: string,
  fromName: string,
  previousSubject: string,
  previousBody: string,
  instructions: string,
  leadCountry?: string,
  agencyProfileId?: number | null
): Promise<EmailGeneration> {
  const ctx = getAgencyContext(agencyProfileId);
  const effectiveCountry = leadCountry || ctx.country;
  const localeLabel = getLocaleLabel(effectiveCountry);
  const writingRules = getLocaleWritingRules(effectiveCountry);

  const examplesBlock = formatEmailExamples("initial", 3);

  const prompt = `${PERSONA_BLOCK(fromName, ctx.name)}

You need to REGENERATE a cold outreach email you already wrote, applying a new tone or instructions.

AGENCY CONTEXT (identity and services; DO NOT invent data that is not here):
${formatAgencyContextBlock(ctx, { identityOnly: true })}

BUSINESS DATA:
- Name: ${businessName}
- Category: ${businessCategory || "Not specified"}
- City: ${city || "Not specified"}
- Web: ${websiteUrl || "None"}
- Web quality: ${analysis.qualityScore}/100
- SEO: ${analysis.seoScore ?? "N/A"}/100
- Issues: ${sanitizeIssues(analysis.issues).join(", ")}
- SEO opportunities: ${sanitizeIssues(analysis.seoIssues).join(", ")}
- AI opportunities: ${(analysis.aiAgentOpportunities || []).join(", ")}

PREVIOUS EMAIL:
Subject: ${previousSubject}
Body: ${previousBody}

NEW TONE: ${tone}
ADDITIONAL INSTRUCTIONS: ${instructions || "Just change the tone"}
LANGUAGE: ${localeLabel}

CORE KEY PRINCIPLE: the email focuses on what the recipient GAINS (more clients, more sales, more visibility), NOT on listing technical problems. Every problem is translated into business impact. DO NOT use "free", "no commitment", "free audit" — use natural alternatives.

Do not add legal footer or unsubscribe text; the system injects it.

${ANTI_AI_RULES}

REGIONAL ADAPTATION (CRITICAL):
The business is in ${city || "location not specified"}. Adapt to the country of THAT city. If in Mexico, Mexican Spanish. If in Argentina, voseo. If in Spain, Spanish from Spain.
${writingRules}

EXAMPLES OF THE STYLE WE WANT (don't copy literally, capture the tone):
${examplesBlock}

${SELF_CHECK_EMAIL(110)}

Generate a different version of the email. Respond ONLY with valid JSON (no markdown, no backticks):
{
  "subject": "new subject",
  "bodyHtml": "new HTML",
  "bodyText": "new plain text version"
}`;

  return withRetry(
    () => generateStructured<EmailGeneration>({ prompt, jsonSchema: EMAIL_SCHEMA, label: "regenerate-email" }),
    { maxRetries: GEMINI_MAX_RETRIES, baseDelayMs: GEMINI_BASE_DELAY_MS, label: "regenerate-email" },
  );
}

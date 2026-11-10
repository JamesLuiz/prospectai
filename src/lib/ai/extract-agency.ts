import { getGenAI, safeParseJSON, cleanJsonResponse, SERVICE_DEFINITIONS } from "./config";
import { withRetry } from "@/lib/ai/retry";
import { geminiRateLimiter } from "@/lib/ai/rate-limiter";
import { GEMINI_MAX_RETRIES, GEMINI_BASE_DELAY_MS } from "@/lib/constants";
import { scrapeWebsite, type ScrapeResult } from "@/lib/scraper";

export interface ExtractedAgency {
  name: string | null;
  tagline: string | null;
  description: string | null;
  ownerName: string | null;
  ownerRole: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  country: string | null; // ISO-2 (ES, MX, US, etc.)
  services: string[]; // keys from SERVICE_DEFINITIONS detected on the site
  customServices: { label: string; description: string }[];
  valueProps: string[];
  caseStudies: { client: string; result: string; snippet?: string }[];
}

const COMMON_PATHS = [
  "/", // home (handled separately as the canonical URL)
  "/about",
  "/about-us",
  "/sobre-nosotros",
  "/nosotros",
  "/quienes-somos",
  "/services",
  "/servicios",
  "/contact",
  "/contacto",
  "/team",
  "/equipo",
];

function urlOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildCandidateUrls(baseUrl: string): string[] {
  const origin = urlOrigin(baseUrl);
  if (!origin) return [baseUrl];
  const seen = new Set<string>();
  const out: string[] = [];
  // Always start with the canonical URL the user provided
  if (!seen.has(baseUrl)) {
    seen.add(baseUrl);
    out.push(baseUrl);
  }
  for (const path of COMMON_PATHS) {
    if (path === "/") continue;
    const candidate = origin + path;
    if (!seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
  }
  return out;
}

export interface MultiScrapeResult {
  pages: { url: string; result: ScrapeResult }[];
  rootSucceeded: boolean;
  combinedContent: string;
  combinedEmails: string[];
}

export async function multiPageScrape(baseUrl: string): Promise<MultiScrapeResult> {
  const candidates = buildCandidateUrls(baseUrl);
  const results = await Promise.allSettled(candidates.map((u) => scrapeWebsite(u)));

  const pages: { url: string; result: ScrapeResult }[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      pages.push({ url: candidates[i], result: r.value });
    }
  });

  const successful = pages.filter((p) => p.result.success);
  const rootSucceeded = pages[0]?.result.success ?? false;

  const combinedContent = successful
    .map((p) => `--- ${p.url} ---\n${[p.result.title, p.result.description, p.result.content].filter(Boolean).join("\n")}`)
    .join("\n\n")
    .substring(0, 12000);

  const allEmails = new Set<string>();
  successful.forEach((p) => (p.result.emails || []).forEach((e) => allEmails.add(e)));

  return {
    pages,
    rootSucceeded,
    combinedContent,
    combinedEmails: [...allEmails],
  };
}

const SERVICE_KEYS = Object.keys(SERVICE_DEFINITIONS);

export async function extractAgencyFromScrape(
  baseUrl: string,
  scrape: MultiScrapeResult
): Promise<ExtractedAgency> {
  if (!scrape.rootSucceeded || scrape.combinedContent.length < 50) {
    throw new Error("No se pudo leer suficiente contenido de la web. Verifica la URL.");
  }

  const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });

  const servicesCatalog = SERVICE_KEYS
    .map((k) => `- ${k}: ${SERVICE_DEFINITIONS[k].label} (${SERVICE_DEFINITIONS[k].description})`)
    .join("\n");

  const emailsHint = scrape.combinedEmails.length
    ? `\nEMAILS FOUND ON THE WEBSITE (there may be generic or personal ones):\n${scrape.combinedEmails.join(", ")}`
    : "";

  const prompt = `You are an analyst who extracts structured data from an agency or professional website to build its profile. Analyze the scraped content and return ONLY real data present in the text. DO NOT invent names, services, or case studies that are not explicit.

URL OF THE AGENCY: ${baseUrl}

SCRAPED CONTENT (multiple pages concatenated):
${scrape.combinedContent}
${emailsHint}

STANDARD SERVICES CATALOG (map to these keys ONLY if the agency offers something equivalent):
${servicesCatalog}

INSTRUCTIONS:
1. "name": Commercial name of the agency/professional. If not clear, infer from the title or domain. No legal suffixes (S.L., LLC, etc.) unless part of the visible branding.
2. "tagline": Value proposition phrase (1 line, ~10 words) if the website has it. Null if not.
3. "description": 1-2 sentences describing what the agency does, based on the content. Neutral tone.
4. "ownerName": Real name of the founder/responsible person if it appears in about/team. Null if it does not appear (DO NOT invent).
5. "ownerRole": Role of the responsible person (CEO, founder, director, etc.) if present. Null if not.
6. "contactEmail": Main contact email. Prefer one of the detected ones. Null if none.
7. "contactPhone": Main phone number with country code if it appears. Null if not.
8. "city": Main operating city if mentioned. Null if not.
9. "country": ISO-2 country code (ES, MX, AR, CO, CL, PE, EC, UY, US, UK, CA, AU, BR, PT, FR, DE, IT, NL). Deduce from domain TLD, address, or language + clues. Null if it cannot be deduced with confidence.
10. "services": Array of catalog keys above that the agency ACTUALLY offers based on the content. Empty if it cannot be mapped.
11. "customServices": Array of services they offer that do NOT fit the catalog. Each item: {"label": "Service name", "description": "1 line"}. Empty if everything fits.
12. "valueProps": Array of 2-4 phrases highlighting REAL differentiators mentioned (years of experience, specialization, technologies, etc.). Empty if there is nothing concrete.
13. "caseStudies": Array of case studies or recognized clients mentioned. Each item: {"client": "Name", "result": "what was achieved", "snippet": "optional quote"}. Empty if none are mentioned.

If a field is not in the content, use null (string fields) or [] (arrays). DO NOT invent data.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "name": "...",
  "tagline": null,
  "description": "...",
  "ownerName": null,
  "ownerRole": null,
  "contactEmail": null,
  "contactPhone": null,
  "city": null,
  "country": null,
  "services": [],
  "customServices": [],
  "valueProps": [],
  "caseStudies": []
}`;

  const result = await withRetry(async () => {
    await geminiRateLimiter.acquire();
    return model.generateContent(prompt);
  }, { maxRetries: GEMINI_MAX_RETRIES, baseDelayMs: GEMINI_BASE_DELAY_MS, label: "extract-agency" });

  const text = result.response.text().trim();
  const jsonStr = cleanJsonResponse(text);
  const parsed = safeParseJSON<ExtractedAgency>(jsonStr, "extract-agency");

  // Sanity defaults
  return {
    name: parsed.name || null,
    tagline: parsed.tagline || null,
    description: parsed.description || null,
    ownerName: parsed.ownerName || null,
    ownerRole: parsed.ownerRole || null,
    contactEmail: parsed.contactEmail || null,
    contactPhone: parsed.contactPhone || null,
    city: parsed.city || null,
    country: parsed.country || null,
    services: Array.isArray(parsed.services) ? parsed.services.filter((k) => SERVICE_KEYS.includes(k)) : [],
    customServices: Array.isArray(parsed.customServices) ? parsed.customServices : [],
    valueProps: Array.isArray(parsed.valueProps) ? parsed.valueProps : [],
    caseStudies: Array.isArray(parsed.caseStudies) ? parsed.caseStudies : [],
  };
}

export async function scrapeAndExtract(baseUrl: string): Promise<{ extracted: ExtractedAgency; pagesScraped: number }> {
  const scrape = await multiPageScrape(baseUrl);
  const extracted = await extractAgencyFromScrape(baseUrl, scrape);
  return { extracted, pagesScraped: scrape.pages.filter((p) => p.result.success).length };
}

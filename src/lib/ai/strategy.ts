// Per-campaign copy angle. The returned block is injected into the generation
// prompt through the existing `customInstructions` channel so the model leads
// with the right offer for each campaign profile. Prices never go in the copy.

export type CampaignStrategy = "web_design" | "seo_visibility";

const DIRECTIVES: Record<CampaignStrategy, string> = {
  web_design: `CAMPAIGN FOCUS — WEBSITE DESIGN:
The central problem to sell is their WEBSITE (bad, outdated or nonexistent) and how it costs them clients. Lead with that. The service you offer is creating or renewing their website. You can mention visibility/SEO only if it fits naturally as a complement, not as the center. DO NOT mention prices.`,

  seo_visibility: `CAMPAIGN FOCUS — GOOGLE VISIBILITY (SEO):
The service to sell is VISIBILITY: that they appear on Google when people search for their type of business in their area. Central angle: today, when someone searches "[their category] in [their city]", the competition shows up and they don't, so they lose clients who are already looking. Offer to position them (local SEO, optimize their Google profile, appear on the map and in directories, reviews). It's a CONTINUOUS service that brings them clients month after month, not a one-off fix. DO NOT propose redesigning their website unless it is broken or a real obstacle. DO NOT mention prices.`,
};

/** Returns the campaign angle directive, or "" for unknown/unset strategies. */
export function campaignStrategyDirective(strategy?: string | null): string {
  if (strategy === "web_design" || strategy === "seo_visibility") {
    return DIRECTIVES[strategy];
  }
  return "";
}

/** Merge the campaign angle with any existing custom instructions. */
export function withStrategyDirective(
  strategy: string | null | undefined,
  existing?: string | null,
): string | undefined {
  const merged = [campaignStrategyDirective(strategy), existing]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join("\n\n");
  return merged || undefined;
}

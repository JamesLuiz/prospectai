/**
 * Few-shot bank of validated examples.
 *
 * These examples are the #1 lever to get the LLM to generate copy with a real
 * human tone instead of "AI smell". Better to show 3 real examples of the
 * desired style than to write 30 lines of instructions describing it.
 *
 * Validated styles:
 * - email: A (ultra direct) / B (close/professional) / D (casual)
 * - whatsapp: A (ultra-short) / B (permission-based) / C (observation + proposal)
 *
 * To add more examples: keep the same tone. No em-dashes. No "hope you're well".
 * No AI vocabulary. Mix sentence lengths.
 */

export type EmailExample = {
  style: "direct" | "close" | "casual";
  context: string;
  subject: string;
  body: string;
};

export type WhatsAppExample = {
  style: "direct" | "permission" | "observation" | "close";
  context: string;
  message: string;
};

export type CopyPurpose = "initial" | "follow_up" | "breakup";

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL — INITIAL
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_EXAMPLES_INITIAL: EmailExample[] = [
  {
    style: "direct",
    context: "Restaurant in Barcelona, web not responsive",
    subject: "the web of El Rincón de Lola",
    body: `Hi [name],

I found El Rincón de Lola in Barcelona. The menu looks great, but the website works against you: it loads poorly on mobile and that's where most people who book a table for dinner come from.

We help restaurants get a website that actually brings reservations, not just one that exists.

Want me to send a case similar to yours and see if it makes sense?

Best,
Pablo`,
  },
  {
    style: "close",
    context: "Restaurant in Barcelona, web not responsive",
    subject: "an idea for your web",
    body: `Hi [name],

I was browsing restaurants in Barcelona and came across El Rincón de Lola. The reviews are great and the place looks well made.

The problem: when I opened their website from my phone, I almost left. It loads slowly and falls apart. A lot of people who search for a place to eat in Barcelona end up there and don't stay.

We work with restaurants so the website does what it's supposed to: get people to book before they close the tab.

If you want, I'll show you how we did it, no more than that.

Best,
Pablo`,
  },
  {
    style: "casual",
    context: "Restaurant in Barcelona, web not responsive",
    subject: "quick thing about your web",
    body: `Hi [name],

Quick one. I was looking for dinner in Triana, found El Rincón de Lola and opened the site from my phone. Got nothing.

Not to give you a hard time, the opposite: the menu and reviews are great. But the web doesn't back it up, and that's where people who already chose you are dropping off.

We help restaurants with this. If you want, I'll tell you in two lines.

Pablo`,
  },
  {
    style: "direct",
    context: "Solo clinic in Madrid, old web",
    subject: "patients looking for a dermatologist in Madrid",
    body: `Hi Carlos,

I saw your clinic and opened it from my phone because I wanted to see the hours. Almost left: the web loads badly and it's hard to find basic info. People looking for a dermatologist in Madrid are landing there and leaving.

We help solo clinics get a web that conveys trust and fills the schedule on its own, without relying only on insurers.

Want me to send a case of a similar clinic and see if it makes sense?

Best,
Pablo`,
  },
  {
    style: "close",
    context: "Dental clinic in Valencia, bad local SEO",
    subject: "an idea for Clínica Sonríe",
    body: `Hi María,

I was looking at dentists in Valencia and came across Clínica Dental Sonríe. The reviews are great and you can tell they care about the attention.

The issue: when I searched "dentist Valencia" on Google, you weren't on page one. New people looking for a dentist in the city rarely get past the first few results, and that's where the competition is.

We work with dental clinics so they appear right when people need them, without depending only on lifelong patients.

If you want, I'll show you how we plan it, no more than that.

Best,
Pablo`,
  },
  {
    style: "casual",
    context: "Physiotherapy center in Bilbao, no online booking",
    subject: "quick thing about your web",
    body: `Hi Iker,

Quick one. My back hurt the other day, I searched for a physio in Indautxu and found Activa. Reviews looked good, so I opened the web. Wanted to book a visit but there was only a phone number, it was 11pm.

Not to say anything bad about it, the team looks solid and the site is taken care of. But here's the thing: people who already chose you are falling off because they can't book in the moment.

We help centers like yours with this. If you want, I'll tell you in two lines.

Pablo`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL — FOLLOW-UP
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_EXAMPLES_FOLLOWUP: EmailExample[] = [
  {
    style: "direct",
    context: "Restaurant in Barcelona, follow-up after initial",
    subject: "did you see it?",
    body: `Hi [name],

Last week I wrote about the web of El Rincón de Lola. Maybe you missed it.

The gist: you're losing people who already chose you because the web loads badly on mobile. Easy fix.

If you're interested, I'll show you how, just say the word.

Best,
Pablo`,
  },
  {
    style: "close",
    context: "Dental clinic in Valencia, follow-up shifting angle to SEO",
    subject: "continuing with Sonríe",
    body: `Hi María,

I wrote a few days ago about Clínica Sonríe, maybe you missed it in the daily chaos.

Just to leave another way of seeing it: while this doesn't move, patients who look for a dentist in Valencia are landing on other clinics. Every day.

If you want, I'll explain it in five minutes, just tell me when it's good for you.

Best,
Pablo`,
  },
  {
    style: "casual",
    context: "Physiotherapy center in Bilbao, soft follow-up",
    subject: "quick about Activa",
    body: `Hi Iker,

I know you're swamped, I'm not stealing more than a minute.

The online booking thing is still there. Meanwhile, people who already chose you are dropping off because they can't close a booking at 11pm.

If it fits, I'll tell you. If not, leave me alone.

Pablo`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL — BREAKUP
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_EXAMPLES_BREAKUP: EmailExample[] = [
  {
    style: "direct",
    context: "Restaurant in Barcelona, breakup",
    subject: "closing with this",
    body: `Hi [name],

It's the last time I write to you, promise.

If later you're curious about how your web compares to other restaurants in Barcelona, write to me and I'll send it. Nothing more.

Best,
Pablo`,
  },
  {
    style: "close",
    context: "Dental clinic in Valencia, respectful breakup",
    subject: "resting",
    body: `Hi María,

I understand it's not the moment or that we simply don't fit. No problem.

If at any point you want to see how other dental clinics in Valencia are capturing patients from Google, you know where to find me.

Best,
Pablo`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP — INITIAL
// ─────────────────────────────────────────────────────────────────────────────

export const WHATSAPP_EXAMPLES_INITIAL: WhatsAppExample[] = [
  {
    style: "direct",
    context: "Auto repair shop in Mexico, no web",
    message: `Hi [name], I'm Pablo from VanguardIA. I searched AutoExpress on Google and found no web. The people who look for an auto repair shop in Guadalajara are finding the competition instead. Interested in hearing how we fix that?`,
  },
  {
    style: "permission",
    context: "Auto repair shop in Mexico, no web",
    message: `Hi [name], I'm Pablo from VanguardIA. Quick question: AutoExpress doesn't show up on Google when someone searches for an auto repair shop in Guadalajara. Want me to send you 2 lines on how we solved it for similar shops?`,
  },
  {
    style: "observation",
    context: "Auto repair shop in Mexico, no web",
    message: `Hi [name], Pablo from VanguardIA here. I searched for an auto repair shop in Guadalajara on Google and AutoExpress didn't show up, even with good reviews. That's customers walking to the competition. Want me to analyze how many are losing?`,
  },
  {
    style: "direct",
    context: "Individual cardiologist in Monterrey (you, senior doctor)",
    message: `Hi Dr. Vargas, I'm Pablo from VanguardIA. I searched for a cardiologist in Monterrey on Google and the clinic didn't appear. The patients who are looking right now are finding the competition. Interested in hearing how we solved that for similar doctors?`,
  },
  {
    style: "permission",
    context: "Aesthetic clinic in Spain, bad local SEO",
    message: `Hi María, I'm Pablo from VanguardIA. Quick question: Bella Clinic doesn't show up on Google when someone searches for laser hair removal in Seville. Want me to send you 2 lines on how we solved it for other aesthetic clinics?`,
  },
  {
    style: "observation",
    context: "Medical center in Colombia, no online booking",
    message: `Hi Andrea, Pablo from VanguardIA here. I checked Centro Salud Total's web to see how they book appointments and you can't do it online, only by phone. That's patients getting tired of calling and going elsewhere. Want me to build an analysis of how much they're losing?`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP — FOLLOW-UP
// ─────────────────────────────────────────────────────────────────────────────

export const WHATSAPP_EXAMPLES_FOLLOWUP: WhatsAppExample[] = [
  {
    style: "direct",
    context: "Auto repair shop in Mexico, follow-up",
    message: `Hi [name], Pablo from VanguardIA again. I wrote about AutoExpress and it doesn't show up on Google. Maybe you missed it. Interested in hearing about it?`,
  },
  {
    style: "permission",
    context: "Aesthetic clinic in Spain, follow-up",
    message: `Hi María, I'm writing again about Bella Clinic and the laser hair removal search in Seville. I know you're busy. Want me to send the 2 lines and you decide if it makes sense?`,
  },
  {
    style: "observation",
    context: "Medical center in Colombia, follow-up about booking issue",
    message: `Hi Andrea, I wrote to you a few days ago about booking appointments online at Centro Salud Total. Still the same number of patients calling, no one answers at first, and they go elsewhere. Want to look at it?`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP — BREAKUP
// ─────────────────────────────────────────────────────────────────────────────

export const WHATSAPP_EXAMPLES_BREAKUP: WhatsAppExample[] = [
  {
    style: "direct",
    context: "Auto repair shop in Mexico, breakup",
    message: `Hi [name], I'm Pablo from VanguardIA. I wrote about AutoExpress not showing up on Google and I'm closing with this. If later you're curious about how your web compares, write to me and I'll send it. Take care.`,
  },
  {
    style: "close",
    context: "Aesthetic clinic in Spain, breakup respectful",
    message: `Hi María, I don't want to take up space anymore. If at any point you want to see how other clinics in Seville are capturing patients from Google, you know where to write me. Take care.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Formatters to inject into the LLM prompt
// ─────────────────────────────────────────────────────────────────────────────

function pickEmailBank(purpose: CopyPurpose): EmailExample[] {
  if (purpose === "follow_up") return EMAIL_EXAMPLES_FOLLOWUP;
  if (purpose === "breakup") return EMAIL_EXAMPLES_BREAKUP;
  return EMAIL_EXAMPLES_INITIAL;
}

function pickWhatsAppBank(purpose: CopyPurpose): WhatsAppExample[] {
  if (purpose === "follow_up") return WHATSAPP_EXAMPLES_FOLLOWUP;
  if (purpose === "breakup") return WHATSAPP_EXAMPLES_BREAKUP;
  return WHATSAPP_EXAMPLES_INITIAL;
}

/**
 * Returns the first `maxExamples` examples of the bank for `purpose`,
 * already formatted as a text block ready to concatenate into the prompt.
 */
export function formatEmailExamples(purpose: CopyPurpose, maxExamples = 3): string {
  const bank = pickEmailBank(purpose);
  const picked = bank.slice(0, maxExamples);
  if (picked.length === 0) return "";
  return picked
    .map(
      (ex, i) => `EXAMPLE ${i + 1} — style "${ex.style}" — ${ex.context}
Subject: ${ex.subject}
Body:
${ex.body}`,
    )
    .join("\n\n---\n\n");
}

export function formatWhatsAppExamples(purpose: CopyPurpose, maxExamples = 3): string {
  const bank = pickWhatsAppBank(purpose);
  const picked = bank.slice(0, maxExamples);
  if (picked.length === 0) return "";
  return picked
    .map(
      (ex, i) => `EXAMPLE ${i + 1} — style "${ex.style}" — ${ex.context}
${ex.message}`,
    )
    .join("\n\n---\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Banlists and anti-AI-smell rules (shared between email/whatsapp/templates)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Text block injected into every prompt to reduce the "AI smell".
 * Written in English because the banned-word lists are language specific.
 */
export const ANTI_AI_RULES = `RULES AGAINST "AI COPY" (CRITICAL):

FORBIDDEN VOCABULARY (flags AI-generated copy, DO NOT use):
leverage, deep dive, robust, fluid, holistic, synergies, integral, panorama, unlock, amplify, foster, navigate (figurative sense), revolutionize, transform, optimize (excessive), maximize, capitalize.

FORBIDDEN CONNECTORS (sound academic, DO NOT use):
moreover, in this sense, it should be noted, worth mentioning, on the other hand (as a connector), ultimately, in summary, however (in informal messages), it's important to highlight that.

FORBIDDEN OPENINGS (kill reply rate, NEVER start like this):
- "Hope you're well" / "Hope this email finds you well"
- "My name is X and I work at Y"
- "I'm writing to..."
- "I wanted to reach out..."
- "Hi [recipient]" / "To whom it may concern"
- "Receive my cordial regards"

FORBIDDEN CLOSINGS:
"Sincerely", "Kind regards", "Receive my cordial regards".
USE: "Best," or "Keep me in mind,".

VARIATION OF SENTENCE LENGTH (mandatory):
Mix short sentences (3-7 words) with medium or long ones (15-25). NEVER three sentences in a row of the same length. Allow some natural sentence fragments ("No more.", "If it fits.", "If it makes sense.").

SPAM WORDS (kill deliverability):
free, no commitment, guaranteed, exclusive offer, urgent, discount, no cost, click here, free audit. USE natural alternatives: "send you an analysis", "teach you how", "tell you in two lines".`;

export const PERSONA_BLOCK = (fromName: string, agencyName: string) =>
  `THE SENDER:
You are ${fromName}, writing from ${agencyName}. It's Monday morning, you have coffee in hand and you're sending this message between meetings, in a couple of minutes. You are NOT a marketing department writing copy. You are a real person who saw something about this business and has an idea for them. Your goal is not to sell in this message, it's to open a conversation.

You write the way you'd talk to a colleague from another field who doesn't know you yet: respectful but not formal, with your own judgment but without pushing, brief because you know the other person is busy.`;

export const SELF_CHECK_EMAIL = (maxWords: number) =>
  `BEFORE RESPONDING, review your wording against these points. If any one fails, REWRITE before returning the JSON:

1. Any em-dash or long dash (—)? Replace with comma, period, colon, or parentheses.
2. Does it start with "Hope you're well", "My name is", "I'm writing to", "Hi [recipient]", "To whom it may concern"? Rewrite the opening.
3. Any forbidden vocabulary or forbidden connector word? Replace it.
4. More than ${maxWords} words in the body? Shorten it.
5. Three sentences in a row with the same length? Mix short and long.
6. Is the CTA asking for a direct meeting, calendar, or sounding like a seller? Soften to a soft interest check.
7. Is the closing "Sincerely" or similar? Change to "Best," or "Keep me in mind,".
8. Does it sound like a template or a brochure anywhere? If yes, give it a more human spin.

Return ONLY the final version in JSON, already passed these checks.`;

export const SELF_CHECK_WHATSAPP = `BEFORE RESPONDING, make sure the message meets ALL of these points. If any one fails, REWRITE:

1. The message is plain text the recipient reads as-is on their phone. Nothing more, no special formatting.
2. Any em-dash or long dash (—)? Replace.
3. Any opening sign "¿" or "¡"? Remove (WhatsApp users don't use them).
4. Does it include "Hope you're well", "My name is", or a banned word? Rewrite.
5. More than 300 characters? Shorten.
6. More than 1 emoji? Remove extras (better 0).
7. Any URL, link, or domain? Remove (triggers blocking).
8. Does it ask for a meeting/call/calendar directly? Soften to an open question like "interested?".
9. Does it sound like a template? If yes, give it a more human spin.`;

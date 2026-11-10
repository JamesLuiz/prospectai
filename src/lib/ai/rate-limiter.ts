export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillPerSecond: number
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until a token is available
    const waitMs = ((1 - this.tokens) / this.refillPerSecond) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillPerSecond);
    this.lastRefill = now;
  }
}

// 10 requests burst, 2/sec sustained — generous for Gemini's free tier
export const geminiRateLimiter = new TokenBucketRateLimiter(10, 2);

// Mistral's free tier is stricter (≈1 req/sec). 5 burst, 1/sec sustained is a
// safe default that still keeps copy generation moving.
export const mistralRateLimiter = new TokenBucketRateLimiter(5, 1);

// OpenAI's default tier is more generous; 10 burst, 2/sec sustained keeps the
// chat responsive without hammering the API.
export const openaiRateLimiter = new TokenBucketRateLimiter(10, 2);

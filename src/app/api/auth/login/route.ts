import { NextRequest, NextResponse } from "next/server";
import {
  validateCredentials,
  createSession,
  setSessionCookie,
  checkRateLimit,
  resetRateLimit,
  AuthNotConfiguredError,
} from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  // Get client IP for rate limiting
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";

  // Check rate limit
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many attempts", retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    const valid = await validateCredentials(username, password);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Reset rate limiter on successful login
    resetRateLimit(ip);

    // Create session and set cookie
    const token = await createSession(username);
    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthNotConfiguredError) {
      logger.error(
        `[auth] Login impossible — ${err.message} (values are read at runtime; `.concat(
          "make sure they are present in the container/process env, not just in a local .env.local)"
        )
      );
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 503 }
      );
    }
    logger.error({ err }, "Login error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

"use server";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSession,
  passcodeMatches,
} from "@/lib/auth";

/**
 * Check a passcode and, if it is right, remember this device.
 *
 * Returns a plain result rather than throwing: a wrong passcode is a normal
 * thing for a person to do, not an exception.
 */
export async function unlock(attempt: string): Promise<{ ok: boolean }> {
  // Slow every attempt down. Nothing here is a real rate limiter — serverless
  // gives no reliable place to count — but it turns an online brute force
  // from hours into years, which is the part that matters.
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (!passcodeMatches(attempt.trim())) return { ok: false };

  (await cookies()).set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { ok: true };
}

/** Sign this device out. */
export async function lock() {
  (await cookies()).delete(SESSION_COOKIE);
}

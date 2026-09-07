/**
 * The passcode gate.
 *
 * One user, one passcode, set as APP_PASSCODE. Unset means the gate is off,
 * so `npm run dev` and the demo still run with no configuration at all.
 *
 * A session is an HMAC over its own expiry, keyed by the passcode. Two
 * consequences worth knowing:
 *
 *   - The cookie carries no secret. Stealing it gets you a session, which is
 *     true of every session cookie; it does not get you the passcode.
 *   - Changing APP_PASSCODE invalidates every existing session, because the
 *     key that signed them is gone. That is the revoke button.
 *
 * Web Crypto only, no Node built-ins, so this runs in middleware on the edge
 * as well as on the server.
 */

export const SESSION_COOKIE = "ody_session";

/** A year. This is a personal tool; being asked weekly would be a bug. */
export const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Below this, a passcode is guessable rather than secret. */
export const MIN_PASSCODE_LENGTH = 6;

/**
 * True when APP_PASSCODE is set to anything at all.
 *
 * Deliberately NOT "set to something long enough". Refusing to lock because
 * the passcode is weak is the one behaviour that could actually hurt: you
 * would set a passcode, believe the app was closed, and it would be wide
 * open with nothing saying so. A weak passcode still locks; `passcodeIsWeak`
 * is how the app says it is weak.
 */
export function passcodeIsConfigured(): boolean {
  const value = process.env.APP_PASSCODE;
  return value !== undefined && value.trim() !== "";
}

/** Set, but short enough to guess. Worth saying out loud in Settings. */
export function passcodeIsWeak(): boolean {
  const value = (process.env.APP_PASSCODE ?? "").trim();
  return value !== "" && value.length < MIN_PASSCODE_LENGTH;
}

function passcode(): string {
  return (process.env.APP_PASSCODE ?? "").trim();
}

async function sign(payload: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(payload),
  );
  return base64url(new Uint8Array(signature));
}

/** Mint a session that expires `SESSION_MAX_AGE_SECONDS` from now. */
export async function createSession(): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `v1.${expires}`;
  return `${payload}.${await sign(payload, passcode())}`;
}

/** True when `token` is one we signed and it has not expired. */
export async function sessionIsValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;

  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires * 1000 <= Date.now()) return false;

  const expected = await sign(`v1.${parts[1]}`, passcode());
  return timingSafeEqual(expected, parts[2]);
}

/**
 * True when `attempt` is the passcode.
 *
 * Compared in constant time so the check cannot be walked character by
 * character by timing it.
 */
export function passcodeMatches(attempt: string): boolean {
  return timingSafeEqual(attempt, passcode());
}

/**
 * Constant time for equal-length input, and it leaks only the length — which
 * a caller can learn by other means anyway.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

import { afterEach, describe, expect, it } from "vitest";
import { env, hasEnv } from "./env";

const KEY = "ODYSSEY_ENV_TEST";

afterEach(() => {
  delete process.env[KEY];
});

describe("env", () => {
  it("falls back when the variable is unset", () => {
    expect(env(KEY, "fallback")).toBe("fallback");
  });

  it("falls back when the host set it to an empty string", () => {
    // Vercel does exactly this when you scaffold from .env.example and leave
    // a field blank. `?? ` would not catch it.
    process.env[KEY] = "";
    expect(env(KEY, "fallback")).toBe("fallback");
  });

  it("falls back when the value is only whitespace", () => {
    process.env[KEY] = "   ";
    expect(env(KEY, "fallback")).toBe("fallback");
  });

  it("uses a real value", () => {
    process.env[KEY] = "actual";
    expect(env(KEY, "fallback")).toBe("actual");
  });

  it("reports presence the same way", () => {
    expect(hasEnv(KEY)).toBe(false);
    process.env[KEY] = "";
    expect(hasEnv(KEY)).toBe(false);
    process.env[KEY] = "x";
    expect(hasEnv(KEY)).toBe(true);
  });
});

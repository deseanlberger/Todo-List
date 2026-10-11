import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The cron at /api/reminders is the only thing in the system that runs on its
 * own, which makes it the only thing keeping the Supabase project awake. A
 * free project pauses after seven days of low activity, and once it pauses
 * every page throws on its first query — Today served nothing but its loading
 * skeleton for a month because this handler returned before reading anything.
 *
 * So the contract under test is not "reminders get sent". It is "the database
 * gets read, on every run, whatever else is or is not configured".
 */

const reads = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("@/lib/data", () => ({
  repository: () => ({
    getSettings: async () => {
      reads.calls.push("getSettings");
      return { userId: "test" };
    },
    listWindows: async () => {
      reads.calls.push("listWindows");
      return [];
    },
    listTasks: async () => {
      reads.calls.push("listTasks");
      return [];
    },
    listBlocks: async () => {
      reads.calls.push("listBlocks");
      return [];
    },
  }),
}));

const telegram = vi.hoisted(() => ({ configured: false }));

vi.mock("@/lib/telegram", () => ({
  telegramIsConfigured: () => telegram.configured,
  sendMessage: async () => undefined,
  formatReminder: () => "reminder",
}));

async function run(): Promise<Response> {
  const { GET } = await import("./route");
  return GET(new Request("https://example.com/api/reminders"));
}

describe("the daily cron", () => {
  beforeEach(() => {
    reads.calls = [];
    telegram.configured = false;
    delete process.env.CRON_SECRET;
    delete process.env.TELEGRAM_CHAT_ID;
    vi.resetModules();
  });

  it("reads the database even when Telegram is not configured", async () => {
    const response = await run();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      sent: 0,
      keptDatabaseAwake: true,
    });

    // The regression: this used to be empty, so nothing kept the project awake.
    expect(reads.calls.length).toBeGreaterThan(0);
  });

  it("issues more than one read, because one sits on the pause threshold", async () => {
    await run();
    // Supabase's own wording is "a few user requests to the database each day".
    expect(new Set(reads.calls).size).toBeGreaterThanOrEqual(2);
  });

  it("still reads the database when the chat id is missing but the token is set", async () => {
    telegram.configured = true;
    // No TELEGRAM_CHAT_ID: the other half of the early return.
    await run();
    expect(reads.calls.length).toBeGreaterThan(0);
  });

  it("rejects an unauthorised caller without touching the database", async () => {
    process.env.CRON_SECRET = "secret";
    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://example.com/api/reminders", {
        headers: { authorization: "Bearer wrong" },
      }),
    );

    expect(response.status).toBe(401);
    // The secret check belongs ABOVE the keepalive: an unauthenticated caller
    // must not be able to drive database reads.
    expect(reads.calls).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The route, not the formatter. build.test.ts covers what the iCalendar
 * text should look like; this covers the wiring either side of it — the
 * token check, and whether a block out of the repository actually reaches
 * the feed with its task's title attached.
 */

const repo = vi.hoisted(() => ({ tasks: [] as unknown[] }));

vi.mock("@/lib/data", () => ({
  repository: () => ({ listTasks: async () => repo.tasks }),
}));

function task(over: Record<string, unknown> = {}) {
  return {
    id: "task-9",
    title: "D'Lainey: check force plate numbers",
    notes: null,
    category: "deep_focus",
    status: "backlog",
    needsCategory: false,
    dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    createdAt: "2026-10-11T12:00:00.000Z",
    ...over,
  };
}

async function get(token: string): Promise<Response> {
  const { GET } = await import("./[token]/route");
  return GET(new Request(`https://example.app/api/calendar/${token}`), {
    params: Promise.resolve({ token }),
  });
}

beforeEach(() => {
  repo.tasks = [];
  vi.stubEnv("CALENDAR_TOKEN", "the-secret");
  vi.resetModules();
});

afterEach(() => vi.unstubAllEnvs());

describe("the calendar feed route", () => {
  it("is a 404 when no token is configured, not a 503", async () => {
    // An unconfigured feed should look like nothing is there, rather than
    // advertising that something exists and is misconfigured.
    vi.stubEnv("CALENDAR_TOKEN", "");
    expect((await get("anything")).status).toBe(404);
  });

  it("is a 404 on the wrong token", async () => {
    expect((await get("wrong")).status).toBe(404);
  });

  it("serves the feed on the right token", async () => {
    const response = await get("the-secret");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
  });

  it("accepts the .ics suffix clients append", async () => {
    expect((await get("the-secret.ics")).status).toBe(200);
  });

  it("is never cached, so a change he just made is not hidden at the edge", async () => {
    const response = await get("the-secret");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("puts a due task in the feed with an alarm", async () => {
    repo.tasks = [task()];

    const body = await (await get("the-secret")).text();

    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("SUMMARY:D'Lainey: check force plate numbers");
    expect(body).toContain("UID:task-9@odyssey-scheduler");
    expect(body).toContain("BEGIN:VALARM");
  });

  it("leaves out a task with no due date", async () => {
    repo.tasks = [task({ dueDate: null })];
    expect(await (await get("the-secret")).text()).not.toContain("BEGIN:VEVENT");
  });

  it("leaves out a task due years from now", async () => {
    // The window exists so the phone is not handed everything on every
    // refresh.
    repo.tasks = [task({ dueDate: "2031-01-01T10:00:00.000Z" })];
    expect(await (await get("the-secret")).text()).not.toContain("BEGIN:VEVENT");
  });

  it("leaves out a task due long in the past", async () => {
    repo.tasks = [task({ dueDate: "2020-01-01T10:00:00.000Z" })];
    expect(await (await get("the-secret")).text()).not.toContain("BEGIN:VEVENT");
  });
});

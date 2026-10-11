import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The route, not the formatter. build.test.ts covers what the iCalendar
 * text should look like; this covers the wiring either side of it — the
 * token check, and whether a block out of the repository actually reaches
 * the feed with its task's title attached.
 */

const repo = vi.hoisted(() => ({
  blocks: [] as unknown[],
  tasks: [] as unknown[],
  rangeAskedFor: null as null | { from: string; to: string },
}));

vi.mock("@/lib/data", () => ({
  repository: () => ({
    listBlocksBetween: async (from: string, to: string) => {
      repo.rangeAskedFor = { from, to };
      return repo.blocks;
    },
    listTasks: async () => repo.tasks,
  }),
}));

async function get(token: string): Promise<Response> {
  const { GET } = await import("./[token]/route");
  return GET(new Request(`https://example.app/api/calendar/${token}`), {
    params: Promise.resolve({ token }),
  });
}

beforeEach(() => {
  repo.blocks = [];
  repo.tasks = [];
  repo.rangeAskedFor = null;
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

  it("puts a real block in the feed with its task's title", async () => {
    repo.blocks = [
      {
        id: "block-9",
        userId: "u",
        taskId: "task-9",
        startTime: "2026-10-13T16:00:00.000Z",
        endTime: "2026-10-13T16:45:00.000Z",
        isResetGap: false,
        isDelegation: false,
        gcalEventId: null,
        weekOf: "2026-10-12",
        createdAt: "2026-10-11T12:00:00.000Z",
      },
    ];
    repo.tasks = [
      {
        id: "task-9",
        title: "D'Lainey: check force plate numbers",
        category: "deep_focus",
        location: "home",
        notes: null,
      },
    ];

    const body = await (await get("the-secret")).text();

    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("SUMMARY:D'Lainey: check force plate numbers");
    expect(body).toContain("DTSTART:20261013T160000Z");
    expect(body).toContain("UID:block-9@odyssey-scheduler");
    expect(body).toContain("BEGIN:VALARM");
  });

  it("does not fall over on a block whose task has been deleted", async () => {
    repo.blocks = [
      {
        id: "orphan",
        userId: "u",
        taskId: "gone",
        startTime: "2026-10-13T16:00:00.000Z",
        endTime: "2026-10-13T16:45:00.000Z",
        isResetGap: false,
        isDelegation: false,
        gcalEventId: null,
        weekOf: "2026-10-12",
        createdAt: "2026-10-11T12:00:00.000Z",
      },
    ];

    const body = await (await get("the-secret")).text();
    expect(body).toContain("SUMMARY:Scheduled block");
  });

  it("asks for a window that spans past and future", async () => {
    await get("the-secret");
    const { from, to } = repo.rangeAskedFor!;
    expect(new Date(from).getTime()).toBeLessThan(Date.now());
    expect(new Date(to).getTime()).toBeGreaterThan(Date.now());
  });
});

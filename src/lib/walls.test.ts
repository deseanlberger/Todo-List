import { describe, expect, it } from "vitest";
import { expand } from "./walls";
import type { Commitment } from "./domain/types";
import { formatClock } from "./domain/time";
import { scheduleWeek } from "./scheduler";
import {
  NOW,
  TEST_TZ,
  WEEK_START,
  makeSettings,
  makeTask,
  makeWindow,
} from "./scheduler/fixtures";

const TZ = "America/Los_Angeles";

function commitment(patch: Partial<Commitment> = {}): Commitment {
  return {
    id: "c1",
    userId: "u",
    title: "Flight Academy",
    weekday: 1, // Tuesday
    startTime: "15:00",
    endTime: "17:00",
    location: "gym",
    sortOrder: 0,
    ...patch,
  };
}

/** 2026-09-07 is a Monday. The whole week hangs off that fact. */
const MONDAY = "2026-09-07";

describe("expanding recurring commitments into walls", () => {
  it("lands on the right weekday", () => {
    const events = expand([commitment()], MONDAY, "2026-09-14", TZ);

    expect(events).toHaveLength(1);
    // Tuesday of that week, 15:00 Pacific = 22:00 UTC in September (PDT).
    expect(events[0].start).toBe("2026-09-08T22:00:00.000Z");
    expect(events[0].end).toBe("2026-09-09T00:00:00.000Z");
  });

  it("covers all seven weekdays with no gap and no double-up", () => {
    const week = Array.from({ length: 7 }, (_, weekday) =>
      commitment({ id: `c${weekday}`, weekday, title: `Day ${weekday}` }),
    );

    const events = expand(week, MONDAY, "2026-09-14", TZ);

    expect(events).toHaveLength(7);
    expect(events.map((event) => event.summary).sort()).toEqual([
      "Day 0",
      "Day 1",
      "Day 2",
      "Day 3",
      "Day 4",
      "Day 5",
      "Day 6",
    ]);
  });

  it("repeats across a multi-week range, once per week", () => {
    // Four weeks, a Tuesday commitment: four occurrences.
    const events = expand([commitment()], MONDAY, "2026-10-05", TZ);
    expect(events).toHaveLength(4);
    expect(events.map((event) => event.start.slice(0, 10))).toEqual([
      "2026-09-08",
      "2026-09-15",
      "2026-09-22",
      "2026-09-29",
    ]);
  });

  it("excludes the end date, so back-to-back ranges never double-count", () => {
    const first = expand([commitment()], MONDAY, "2026-09-08", TZ);
    const second = expand([commitment()], "2026-09-08", "2026-09-09", TZ);

    expect(first).toHaveLength(0);
    expect(second).toHaveLength(1);
  });

  it("gives the same commitment on the same date a stable id", () => {
    const once = expand([commitment()], MONDAY, "2026-09-14", TZ);
    const twice = expand([commitment()], MONDAY, "2026-09-14", TZ);

    // The empty-diff-on-re-run guarantee depends on this.
    expect(once[0].id).toBe(twice[0].id);
    expect(once[0].id).toBe("commitment-c1-2026-09-08");
  });

  it("tags location explicitly rather than leaving it to the keyword guess", () => {
    const [gym] = expand([commitment()], MONDAY, "2026-09-14", TZ);
    const [home] = expand(
      [commitment({ location: "home", title: "Payroll call" })],
      MONDAY,
      "2026-09-14",
      TZ,
    );

    expect(gym.atGym).toBe(true);
    expect(home.atGym).toBe(false);
  });

  it("is never ours, so a re-run can not delete it from the calendar", () => {
    const [event] = expand([commitment()], MONDAY, "2026-09-14", TZ);
    expect(event.isOurs).toBe(false);
  });

  it("holds the wall clock across the DST change", () => {
    // Pacific falls back at 2am on Sunday 2026-11-01, so a 9am Sunday
    // commitment is PDT on Oct 25 and PST from Nov 1 on. It must stay at
    // 9am local on every one of them, not drift by an hour.
    const events = expand(
      [commitment({ weekday: 6, startTime: "09:00", endTime: "11:00" })],
      "2026-10-19",
      "2026-11-09",
      TZ,
    );

    expect(events.map((event) => event.start)).toEqual([
      "2026-10-25T16:00:00.000Z", // PDT, UTC-7
      "2026-11-01T17:00:00.000Z", // PST, UTC-8
      "2026-11-08T17:00:00.000Z", // PST, UTC-8
    ]);
  });
});

describe("a commitment reaching the scheduler", () => {
  /** Tuesday 15:00-17:00, inside an otherwise wide-open Tuesday. */
  const flightAcademy = commitment({
    id: "flight",
    title: "Flight Academy",
    weekday: 1,
    startTime: "15:00",
    endTime: "17:00",
  });

  function run(commitments: Commitment[]) {
    return scheduleWeek({
      weekStart: WEEK_START,
      tasks: [
        makeTask({ title: "Invoices", location: "gym", estimatedBlocks: 4 }),
        makeTask({ title: "Emails", location: "gym", estimatedBlocks: 4 }),
      ],
      windows: [makeWindow(1, "13:00", "19:00")],
      overrides: [],
      events: expand(commitments, WEEK_START, "2026-09-14", TEST_TZ),
      currentBlocks: [],
      settings: makeSettings(),
      now: NOW,
      timeZone: TEST_TZ,
    });
  }

  it("blocks every minute it covers", () => {
    const { layout } = run([flightAcademy]);

    expect(layout.placements.length).toBeGreaterThan(0);
    for (const placement of layout.placements) {
      const clash =
        placement.date === "2026-09-08" && placement.start < 17 * 60 && placement.end > 15 * 60;
      expect(
        clash,
        `${placement.task.title} at ${formatClock(placement.start)} runs into Flight Academy`,
      ).toBe(false);
    }
  });

  it("frees the time back up when it is deleted", () => {
    const withIt = run([flightAcademy]);
    const without = run([]);

    // Same tasks, more room: removing the commitment can only place more.
    expect(without.layout.placements.length).toBeGreaterThanOrEqual(
      withIt.layout.placements.length,
    );
    const usedBefore = withIt.layout.placements.some(
      (p) => p.date === "2026-09-08" && p.start >= 15 * 60 && p.start < 17 * 60,
    );
    const usedAfter = without.layout.placements.some(
      (p) => p.date === "2026-09-08" && p.start >= 15 * 60 && p.start < 17 * 60,
    );
    expect(usedBefore).toBe(false);
    expect(usedAfter).toBe(true);
  });
});

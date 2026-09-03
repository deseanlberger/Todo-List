import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatClock,
  formatDuration,
  formatOpenTime,
  formatRange,
  isoDate,
  minutesOfDay,
  weekOf,
  zonedParts,
  zonedTimeToUtc,
} from "./time";
import { comparePriority, isUrgent, urgencyLabel } from "./priority";
import { blockMinutes } from "./categories";
import type { Task } from "./types";

const TZ = "America/Los_Angeles";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t", userId: "u", title: "T", notes: null,
    category: "high_priority_admin", location: "home",
    estimatedBlocks: 1, actualBlocks: null, dueDate: null,
    financialImpact: 3, assignee: null, handedOffAt: null,
    status: "backlog", isRecurring: false, recurrenceRule: null,
    reminderLeadDays: 1, captureSource: "manual", captureTranscript: null,
    createdAt: "2026-09-01T00:00:00Z", completedAt: null,
    ...overrides,
  };
}

describe("time", () => {
  it("round-trips a wall-clock time through UTC and back", () => {
    const instant = zonedTimeToUtc(2026, 9, 7, 5, 30, TZ);
    const parts = zonedParts(instant, TZ);
    expect([parts.year, parts.month, parts.day, parts.hour, parts.minute]).toEqual([
      2026, 9, 7, 5, 30,
    ]);
  });

  it("survives the spring DST transition", () => {
    // 2026-03-08 is when US Pacific springs forward at 02:00.
    const before = zonedTimeToUtc(2026, 3, 7, 9, 0, TZ);
    const after = zonedTimeToUtc(2026, 3, 9, 9, 0, TZ);
    expect(minutesOfDay(before, TZ)).toBe(540);
    expect(minutesOfDay(after, TZ)).toBe(540);
    // 09:00 to 09:00 across the transition is 47 hours, not 48.
    expect((after.getTime() - before.getTime()) / 3_600_000).toBe(47);
  });

  it("survives the autumn DST transition", () => {
    // 2026-11-01 falls back at 02:00.
    const before = zonedTimeToUtc(2026, 10, 31, 9, 0, TZ);
    const after = zonedTimeToUtc(2026, 11, 2, 9, 0, TZ);
    expect((after.getTime() - before.getTime()) / 3_600_000).toBe(49);
  });

  it("finds the Monday of a week, including on a Sunday", () => {
    expect(weekOf(new Date("2026-09-10T19:00:00Z"), TZ)).toBe("2026-09-07");
    expect(weekOf(new Date("2026-09-13T19:00:00Z"), TZ)).toBe("2026-09-07");
    expect(weekOf(new Date("2026-09-14T19:00:00Z"), TZ)).toBe("2026-09-14");
  });

  it("does calendar-day arithmetic across a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(daysBetween("2026-09-07", "2026-09-13")).toBe(6);
  });

  it("reads local date from an instant", () => {
    // 2026-09-08T05:00Z is still 2026-09-07 in Pacific time.
    expect(isoDate(new Date("2026-09-08T05:00:00Z"), TZ)).toBe("2026-09-07");
  });

  it("formats the way the design specifies", () => {
    expect(formatClock(690)).toBe("11:30");
    expect(formatRange(705, 735)).toBe("11:45 – 12:15");
    expect(formatDuration(30)).toBe("30 MIN");
    expect(formatDuration(90)).toBe("1H 30M");
    expect(formatDuration(0)).toBe("—");
    expect(formatOpenTime(450)).toBe("7H 30M OPEN");
    expect(formatOpenTime(0)).toBe("CLOSED");
  });
});

describe("urgency", () => {
  const now = new Date("2026-09-07T16:00:00Z");

  it("flags anything due inside 48 hours", () => {
    expect(isUrgent(task({ dueDate: "2026-09-09T00:00:00Z" }), now)).toBe(true);
    expect(isUrgent(task({ dueDate: "2026-09-10T00:00:00Z" }), now)).toBe(false);
    expect(isUrgent(task({ dueDate: null }), now)).toBe(false);
  });

  it("never flags a completed task", () => {
    expect(isUrgent(task({ dueDate: "2026-09-07T17:00:00Z", status: "done" }), now)).toBe(
      false,
    );
  });

  it("writes the detail-screen label", () => {
    expect(urgencyLabel(task({ dueDate: "2026-09-08T01:00:00Z" }), now)).toBe(
      "URGENT · DUE IN 9H",
    );
    expect(urgencyLabel(task({ dueDate: "2026-09-07T09:00:00Z" }), now)).toBe(
      "URGENT · OVERDUE",
    );
    expect(urgencyLabel(task({ dueDate: null }), now)).toBeNull();
  });
});

describe("priority", () => {
  const now = new Date("2026-09-07T16:00:00Z");

  it("keeps the rules' order of authority", () => {
    const recurring = task({ id: "a", isRecurring: true, financialImpact: 1 });
    const urgent = task({ id: "b", dueDate: "2026-09-07T20:00:00Z", financialImpact: 5 });
    expect(comparePriority(recurring, urgent, now, TZ)).toBeLessThan(0);
  });

  it("is a total order — no pair ever compares equal", () => {
    const tasks = [
      task({ id: "a" }),
      task({ id: "b" }),
      task({ id: "c", financialImpact: 5 }),
    ];
    for (const x of tasks) {
      for (const y of tasks) {
        if (x.id === y.id) continue;
        expect(comparePriority(x, y, now, TZ)).not.toBe(0);
      }
    }
  });
});

describe("categories", () => {
  it("gives Deep Focus 45 minutes and the rest 30", () => {
    expect(blockMinutes("deep_focus")).toBe(45);
    expect(blockMinutes("high_priority_admin")).toBe(30);
    expect(blockMinutes("personal")).toBe(30);
  });

  it("refuses to give Delegate a block size", () => {
    expect(() => blockMinutes("delegate")).toThrow(/does not occupy calendar time/);
  });
});

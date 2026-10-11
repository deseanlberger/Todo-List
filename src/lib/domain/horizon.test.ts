import { describe, expect, it } from "vitest";
import { partitionByHorizon } from "./horizon";
import type { Task } from "./types";

const ZONE = "America/Los_Angeles";
const TODAY = "2026-10-11";

function task(id: string, dueDate: string | null): Task {
  return {
    id,
    userId: "desean",
    title: id,
    notes: null,
    category: "high_priority_admin",
    location: "home",
    estimatedBlocks: 1,
    actualBlocks: null,
    dueDate,
    financialImpact: 3,
    assignee: null,
    handedOffAt: null,
    status: "backlog",
    isRecurring: false,
    recurrenceRule: null,
    reminderLeadDays: 0,
    captureSource: null,
    captureTranscript: null,
    needsCategory: false,
    externalId: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
  };
}

function split(tasks: Task[]) {
  const { now, later } = partitionByHorizon(tasks, TODAY, ZONE);
  return { now: now.map((t) => t.id), later: later.map((t) => t.id) };
}

describe("the seven day horizon", () => {
  it("keeps anything he could start today", () => {
    const { now, later } = split([
      task("overdue", "2026-10-02T17:00:00.000Z"),
      task("today", "2026-10-11T22:00:00.000Z"),
      task("undated", null),
    ]);
    expect(now).toEqual(["overdue", "today", "undated"]);
    expect(later).toEqual([]);
  });

  it("keeps the seventh day and drops the eighth", () => {
    // Noon Pacific on each day, so the UTC instant and the Pacific day agree.
    const { now, later } = split([
      task("day-7", "2026-10-18T19:00:00.000Z"),
      task("day-8", "2026-10-19T19:00:00.000Z"),
    ]);
    expect(now).toEqual(["day-7"]);
    expect(later).toEqual(["day-8"]);
  });

  it("reads the due day where he lives, not in UTC", () => {
    // 8pm Pacific on the seventh day is already the eighth day in UTC.
    // Slicing the ISO string would exile a task he still has a week for.
    const { now, later } = split([task("late-on-day-7", "2026-10-19T03:00:00.000Z")]);
    expect(now).toEqual(["late-on-day-7"]);
    expect(later).toEqual([]);
  });

  it("puts a task three weeks out behind the tap", () => {
    const { now, later } = split([task("november", "2026-11-02T19:00:00.000Z")]);
    expect(now).toEqual([]);
    expect(later).toEqual(["november"]);
  });

  it("does not choke on an unparseable due date", () => {
    const { now, later } = split([task("junk", "not a date")]);
    expect(now).toEqual(["junk"]);
    expect(later).toEqual([]);
  });

  it("keeps each side in the order it was given", () => {
    const { now, later } = split([
      task("a-later", "2026-12-01T19:00:00.000Z"),
      task("b-now", "2026-10-12T19:00:00.000Z"),
      task("c-later", "2026-11-01T19:00:00.000Z"),
      task("d-now", null),
    ]);
    expect(now).toEqual(["b-now", "d-now"]);
    expect(later).toEqual(["a-later", "c-later"]);
  });
});

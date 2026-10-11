import { describe, expect, it } from "vitest";
import type { ScheduledBlock, Task } from "@/lib/domain/types";
import { buildIcs, type IcsBlock } from "./build";

/**
 * A malformed feed does not degrade, it disappears: iOS rejects the whole
 * calendar and shows nothing, with no error anyone sees. So these tests
 * care about the format rules as much as the content.
 */

const OPTIONS = { alarmMinutes: 10, name: "Scheduler", host: "example.app" };

function block(over: Partial<ScheduledBlock> = {}): ScheduledBlock {
  return {
    id: "block-1",
    userId: "u",
    taskId: "task-1",
    startTime: "2026-10-13T16:00:00.000Z",
    endTime: "2026-10-13T16:45:00.000Z",
    isResetGap: false,
    isDelegation: false,
    gcalEventId: null,
    weekOf: "2026-10-12",
    createdAt: "2026-10-11T12:00:00.000Z",
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "u",
    title: "Write SMHS volleyball block 3",
    notes: null,
    category: "deep_focus",
    location: "home",
    estimatedBlocks: 2,
    actualBlocks: null,
    dueDate: null,
    financialImpact: 3,
    assignee: null,
    handedOffAt: null,
    status: "scheduled",
    isRecurring: false,
    recurrenceRule: null,
    reminderLeadDays: 1,
    captureSource: "manual",
    captureTranscript: null,
    needsCategory: false,
    externalId: null,
    createdAt: "2026-10-11T12:00:00.000Z",
    completedAt: null,
    ...over,
  };
}

const one = (entries: IcsBlock[] = [{ block: block(), task: task() }]) =>
  buildIcs(entries, OPTIONS);

describe("the calendar feed", () => {
  it("is a well formed calendar", () => {
    const ics = one();
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
  });

  it("uses CRLF everywhere, which Apple is strict about", () => {
    const ics = one();
    // No bare newline anywhere.
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("carries the task title and times", () => {
    const ics = one();
    expect(ics).toContain("SUMMARY:Write SMHS volleyball block 3");
    expect(ics).toContain("DTSTART:20261013T160000Z");
    expect(ics).toContain("DTEND:20261013T164500Z");
  });

  it("puts an alarm on real work", () => {
    expect(one()).toContain("TRIGGER:-PT10M");
  });

  it("fires on the dot when asked for zero", () => {
    const ics = buildIcs([{ block: block(), task: task() }], { ...OPTIONS, alarmMinutes: 0 });
    expect(ics).toContain("TRIGGER:PT0S");
  });

  it("does not buzz the phone for a reset gap", () => {
    // A reset belongs on the calendar so the day reads honestly, but an
    // alert for it would train him to ignore the ones that matter.
    const ics = buildIcs(
      [{ block: block({ isResetGap: true, taskId: null }), task: null }],
      OPTIONS,
    );
    expect(ics).toContain("SUMMARY:Reset");
    expect(ics).not.toContain("BEGIN:VALARM");
  });

  it("keeps a stable UID per block so a refresh updates rather than duplicates", () => {
    expect(one()).toContain("UID:block-1@example.app");
  });

  it("escapes the characters that would otherwise end a property early", () => {
    const ics = one([
      {
        block: block(),
        task: task({ title: "Call Annie; then Jake, re: pricing", notes: "line one\nline two" }),
      },
    ]);

    expect(ics).toContain("SUMMARY:Call Annie\; then Jake\\, re: pricing");
    // A real newline inside a value would corrupt everything after it.
    expect(ics).toContain("line one\\nline two");
  });

  it("folds a long line without splitting a character in half", () => {
    const long = `Review ${"the force plate numbers ".repeat(8)}with D'Lainey 🏋️`;
    const ics = one([{ block: block(), task: task({ title: long }) }]);

    for (const line of ics.split("\r\n")) {
      expect(Buffer.from(line, "utf8").length).toBeLessThanOrEqual(75);
    }
    // Unfolding (drop CRLF + one leading space) must give the title back
    // intact, emoji included.
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${long.replace(/,/g, "\\,")}`);
  });

  it("survives an empty week", () => {
    const ics = buildIcs([], OPTIONS);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("names a delegation and a block with no task rather than printing nothing", () => {
    const d = buildIcs([{ block: block({ isDelegation: true, taskId: null }), task: null }], OPTIONS);
    expect(d).toContain("SUMMARY:Hand off");

    const orphan = buildIcs([{ block: block(), task: null }], OPTIONS);
    expect(orphan).toContain("SUMMARY:Scheduled block");
  });

  it("tells the phone where the work happens", () => {
    expect(one([{ block: block(), task: task({ location: "gym" }) }])).toContain(
      "LOCATION:The gym",
    );
  });
});

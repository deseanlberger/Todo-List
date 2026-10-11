import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/domain/types";
import { buildIcs } from "./build";

/**
 * A malformed feed does not degrade, it disappears: iOS rejects the whole
 * calendar and shows nothing, with no error anyone sees. So these tests
 * care about the format rules as much as the content.
 */

const OPTIONS = { alarmMinutes: 10, name: "Scheduler", host: "example.app" };

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
    dueDate: "2026-10-13T16:00:00.000Z",
    financialImpact: 3,
    assignee: null,
    handedOffAt: null,
    status: "backlog",
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

const one = (over: Partial<Task> = {}) => buildIcs([task(over)], OPTIONS);

describe("the calendar feed", () => {
  it("is a well formed calendar", () => {
    const ics = one();
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
  });

  it("uses CRLF everywhere, which Apple is strict about", () => {
    expect(/[^\r]\n/.test(one())).toBe(false);
  });

  it("carries the title and the due time", () => {
    const ics = one();
    expect(ics).toContain("SUMMARY:Write SMHS volleyball block 3");
    expect(ics).toContain("DTSTART:20261013T160000Z");
    // A half-hour marker, not a plan for how long the work takes.
    expect(ics).toContain("DTEND:20261013T163000Z");
  });

  it("leaves out a task with no due date rather than inventing a day for it", () => {
    expect(buildIcs([task({ dueDate: null })], OPTIONS)).not.toContain("BEGIN:VEVENT");
  });

  it("leaves out a task whose stored date is unparseable", () => {
    expect(buildIcs([task({ dueDate: "not a date" })], OPTIONS)).not.toContain("BEGIN:VEVENT");
  });

  it("alerts ahead of a task that is still open", () => {
    expect(one()).toContain("TRIGGER:-PT10M");
  });

  it("fires on the dot when asked for zero", () => {
    expect(buildIcs([task()], { ...OPTIONS, alarmMinutes: 0 })).toContain("TRIGGER:PT0S");
  });

  it("does not alert about work already ticked off", () => {
    // It still belongs on the calendar as history, but buzzing about
    // something finished is how an alert stops being read.
    const ics = one({ status: "done" });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).not.toContain("BEGIN:VALARM");
  });

  it("names the list it came from, so the alert has context", () => {
    expect(one()).toContain("DESCRIPTION:Deep Focus");
    expect(one({ needsCategory: true })).toContain("DESCRIPTION:Needs a home");
  });

  it("keeps a stable UID per task so a refresh updates rather than duplicates", () => {
    expect(one()).toContain("UID:task-1@example.app");
  });

  it("escapes the characters that would otherwise end a property early", () => {
    const ics = one({
      title: "Call Annie; then Jake, re: pricing",
      notes: "line one\nline two",
    });
    expect(ics).toContain("SUMMARY:Call Annie\; then Jake\\, re: pricing");
    // A real newline inside a value would corrupt everything after it.
    expect(ics).toContain("line one\\nline two");
  });

  it("folds a long line without splitting a character in half", () => {
    const long = `Review ${"the force plate numbers ".repeat(8)}with D'Lainey 🏋️`;
    const ics = one({ title: long });

    for (const line of ics.split("\r\n")) {
      expect(Buffer.from(line, "utf8").length).toBeLessThanOrEqual(75);
    }
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${long.replace(/,/g, "\\,")}`);
  });

  it("survives an empty list", () => {
    const ics = buildIcs([], OPTIONS);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

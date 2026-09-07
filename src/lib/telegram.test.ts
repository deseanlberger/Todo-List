import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/domain/types";
import { formatCaptureReply, formatReminder, quickEditButtons, specLine } from "./telegram";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1", userId: "u", title: "Payroll — Aug 16–31", notes: null,
    category: "high_priority_admin", location: "home",
    estimatedBlocks: 1, actualBlocks: null,
    dueDate: "2026-09-09T17:00:00Z", financialImpact: 5,
    assignee: null, handedOffAt: null, status: "backlog",
    isRecurring: false, recurrenceRule: null, reminderLeadDays: 1,
    captureSource: "telegram_voice", captureTranscript: null,
    createdAt: "2026-09-03T00:00:00Z", completedAt: null,
    ...overrides,
  };
}

describe("telegram reply formatting", () => {
  it("writes the spec line the design specifies", () => {
    expect(specLine(task())).toBe("HI-PRI ADMIN · HOME · 1 BLOCK · DUE WED · IMPACT 5");
  });

  it("names the assignee instead of a block count for a delegate task", () => {
    expect(
      specLine(task({ category: "delegate", assignee: "Annie", dueDate: null })),
    ).toBe("DELEGATE · HOME · → ANNIE · IMPACT 5");
  });

  it("counts the captured tasks and says what happens next", () => {
    const reply = formatCaptureReply([task(), task({ id: "t2", title: "Order chalk" })]);
    expect(reply.split("\n")[0]).toBe("2 TASKS CAPTURED");
    expect(reply).toContain(
      "They sit in the backlog. Press Schedule My Week in the app to place them.",
    );
  });

  it("uses the delegate closing line when everything captured was a handoff", () => {
    const reply = formatCaptureReply([
      task({ category: "delegate", assignee: "Jake" }),
    ]);
    expect(reply).toContain("It sits in the delegate list for the next handoff block.");
  });

  it("offers block and delegate buttons only for schedulable tasks", () => {
    expect(quickEditButtons(task())[0].map((b) => b.text)).toEqual([
      "Category",
      "Location",
      "Blocks",
      "Delegate →",
    ]);
    expect(
      quickEditButtons(task({ category: "delegate", assignee: "Ty" }))[0].map((b) => b.text),
    ).toEqual(["Category", "Location"]);
  });

  it("keeps callback data inside Telegram's 64-byte cap", () => {
    for (const button of quickEditButtons(task({ id: "a".repeat(36) }))[0]) {
      expect(Buffer.byteLength(button.callback_data)).toBeLessThanOrEqual(64);
    }
  });

  it("says whether a recurring task is already placed", () => {
    expect(formatReminder(task({ title: "Rent" }), "tomorrow, Aug 31", "07:00")).toBe(
      "LEAD-TIME REMINDER\n\nRent is due tomorrow, Aug 31. Recurring, already placed at 07:00.",
    );
    expect(formatReminder(task({ title: "Rent" }), "tomorrow, Aug 31", null)).toContain(
      "not placed yet",
    );
  });
});

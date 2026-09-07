import { describe, expect, it } from "vitest";
import { formatClock } from "@/lib/domain/time";
import {
  NOW,
  TEST_TZ,
  WEEK_START,
  deepFocus,
  makeBlock,
  makeEvent,
  makeOverride,
  makeSettings,
  makeTask,
  makeWindow,
} from "./fixtures";
import { scheduleWeek, templateCapacityBlocks, templateCapacityMinutes } from "./index";
import type { Layout, Placement } from "./place";

interface RunOptions {
  tasks?: Parameters<typeof scheduleWeek>[0]["tasks"];
  windows?: Parameters<typeof scheduleWeek>[0]["windows"];
  overrides?: Parameters<typeof scheduleWeek>[0]["overrides"];
  events?: Parameters<typeof scheduleWeek>[0]["events"];
  currentBlocks?: Parameters<typeof scheduleWeek>[0]["currentBlocks"];
  settings?: Parameters<typeof scheduleWeek>[0]["settings"];
}

function run(options: RunOptions = {}) {
  return scheduleWeek({
    weekStart: WEEK_START,
    tasks: options.tasks ?? [],
    windows: options.windows ?? [makeWindow(0, "05:30", "12:00")],
    overrides: options.overrides ?? [],
    events: options.events ?? [],
    currentBlocks: options.currentBlocks ?? [],
    settings: options.settings ?? makeSettings(),
    now: NOW,
    timeZone: TEST_TZ,
  });
}

/** `MON 05:30 – 06:00` for readable assertions. */
function slotOf(placement: Placement): string {
  return `${placement.date} ${formatClock(placement.start)} – ${formatClock(placement.end)}`;
}

function titles(layout: Layout): string[] {
  return layout.placements.map((p) => p.task.title);
}

describe("§2 block grid", () => {
  it("gives Deep Focus 45 minutes and everything else 30", () => {
    const { layout } = run({
      tasks: [
        deepFocus({ title: "Write block", dueDate: "2026-09-08T17:00:00Z" }),
        makeTask({ title: "Payroll", dueDate: "2026-09-09T17:00:00Z" }),
      ],
    });

    const df = layout.placements.find((p) => p.task.title === "Write block")!;
    const admin = layout.placements.find((p) => p.task.title === "Payroll")!;

    expect(df.end - df.start).toBe(45);
    expect(admin.end - admin.start).toBe(30);
  });

  it("keeps a multi-block task consecutive and never splits it across the day", () => {
    const { layout } = run({
      tasks: [deepFocus({ title: "Macrocycle", estimatedBlocks: 3 })],
    });

    expect(layout.placements).toHaveLength(1);
    expect(slotOf(layout.placements[0])).toBe("2026-09-07 05:30 – 07:45");
  });

  it("leaves a gap under 30 minutes empty rather than squeezing work in", () => {
    const { layout } = run({
      windows: [makeWindow(0, "09:00", "09:20")],
      tasks: [makeTask({ title: "Quick admin" })],
    });

    expect(layout.placements).toHaveLength(0);
    expect(layout.didntFit.map((t) => t.title)).toEqual(["Quick admin"]);
  });

  it("will not put Deep Focus in a gap shorter than 45 minutes", () => {
    const { layout } = run({
      windows: [makeWindow(0, "09:00", "09:30")],
      tasks: [deepFocus({ title: "Programming" })],
    });

    expect(layout.placements).toHaveLength(0);
    expect(layout.didntFit).toHaveLength(1);
  });
});

describe("§3 week template", () => {
  it("places nothing outside a window, however empty the calendar is", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:00")],
      tasks: [makeTask(), makeTask()],
    });

    expect(layout.placements).toHaveLength(1);
    expect(layout.didntFit).toHaveLength(1);
  });

  it("honours a DEEP FOCUS window by refusing admin work", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "08:00", "deep_focus")],
      tasks: [makeTask({ title: "Admin" }), deepFocus({ title: "Programming" })],
    });

    expect(titles(layout)).toEqual(["Programming"]);
    expect(layout.didntFit.map((t) => t.title)).toEqual(["Admin"]);
  });

  it("honours an ADMIN ONLY window by refusing Deep Focus", () => {
    const { layout } = run({
      windows: [makeWindow(0, "20:00", "22:00", "admin_only")],
      tasks: [deepFocus({ title: "Programming" }), makeTask({ title: "Admin" })],
    });

    expect(titles(layout)).toEqual(["Admin"]);
    expect(layout.didntFit.map((t) => t.title)).toEqual(["Programming"]);
  });

  it("treats a NO WORK window as closed without deleting it", () => {
    const windows = [makeWindow(0, "05:30", "08:00", "no_work")];
    const { layout } = run({ windows, tasks: [makeTask()] });

    expect(layout.placements).toHaveLength(0);
    expect(templateCapacityMinutes(windows)).toBe(0);
    // The window is still in the template, ready to be switched back on.
    expect(windows).toHaveLength(1);
  });

  it("closes a single day with a whole-day override without touching the pattern", () => {
    const windows = [makeWindow(0, "05:30", "12:00"), makeWindow(1, "05:30", "12:00")];
    const { layout } = run({
      windows,
      overrides: [makeOverride("2026-09-07", { reason: "Travel" })],
      tasks: [makeTask({ title: "Payroll" })],
    });

    expect(layout.placements[0].date).toBe("2026-09-08");
    expect(templateCapacityMinutes(windows)).toBe(780);
  });

  it("carves a timed override out of the day", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "12:00")],
      overrides: [
        makeOverride("2026-09-07", { startTime: "05:30", endTime: "11:00" }),
      ],
      tasks: [makeTask({ title: "Payroll" })],
    });

    expect(slotOf(layout.placements[0])).toBe("2026-09-07 11:00 – 11:30");
  });

  it("reports capacity in minutes and rough blocks, before resets", () => {
    const windows = [
      makeWindow(0, "05:30", "08:00"), // 150
      makeWindow(1, "12:00", "14:30"), // 150
      makeWindow(2, "20:00", "22:00", "no_work"), // excluded
    ];

    expect(templateCapacityMinutes(windows)).toBe(300);
    expect(templateCapacityBlocks(windows)).toBe(10);
  });
});

describe("§4 reset gaps", () => {
  it("earns a reset after two consecutive 30-minute blocks, not before", () => {
    const { layout } = run({
      tasks: [
        makeTask({ title: "A", dueDate: "2026-09-08T00:00:00Z" }),
        makeTask({ title: "B", dueDate: "2026-09-09T00:00:00Z" }),
        makeTask({ title: "C", dueDate: "2026-09-10T00:00:00Z" }),
      ],
    });

    expect(layout.placements.map(slotOf)).toEqual([
      "2026-09-07 05:30 – 06:00",
      "2026-09-07 06:00 – 06:30",
      "2026-09-07 06:45 – 07:15",
    ]);
    expect(layout.resets.map((r) => `${formatClock(r.start)} – ${formatClock(r.end)}`)).toEqual([
      "06:30 – 06:45",
    ]);
  });

  it("earns a reset after a single 45-minute Deep Focus block", () => {
    const { layout } = run({
      tasks: [
        deepFocus({ title: "Programming", dueDate: "2026-09-08T00:00:00Z" }),
        makeTask({ title: "Admin", dueDate: "2026-09-09T00:00:00Z" }),
      ],
    });

    expect(layout.placements.map(slotOf)).toEqual([
      "2026-09-07 05:30 – 06:15",
      "2026-09-07 06:30 – 07:00",
    ]);
    expect(layout.resets).toHaveLength(1);
  });

  it("never puts a reset inside a task — 90 minutes of Deep Focus runs straight through", () => {
    const { layout } = run({
      tasks: [
        deepFocus({ title: "Macrocycle", estimatedBlocks: 2, dueDate: "2026-09-08T00:00:00Z" }),
        makeTask({ title: "Admin", dueDate: "2026-09-09T00:00:00Z" }),
      ],
    });

    expect(slotOf(layout.placements[0])).toBe("2026-09-07 05:30 – 07:00");
    expect(layout.resets.map((r) => formatClock(r.start))).toEqual(["07:00"]);
    expect(slotOf(layout.placements[1])).toBe("2026-09-07 07:15 – 07:45");
  });

  it("uses the configured 10-minute reset when the setting says so", () => {
    const { layout } = run({
      settings: makeSettings({ resetMinutes: 10 }),
      tasks: [
        deepFocus({ title: "Programming", dueDate: "2026-09-08T00:00:00Z" }),
        makeTask({ title: "Admin", dueDate: "2026-09-09T00:00:00Z" }),
      ],
    });

    expect(layout.resets[0].end - layout.resets[0].start).toBe(10);
  });
});

describe("§5 Deep Focus cap", () => {
  it("caps a weekday at three Deep Focus blocks and rolls the rest onward", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "14:00"), makeWindow(1, "05:30", "14:00")],
      tasks: [
        deepFocus({ title: "A", dueDate: "2026-09-08T00:00:00Z" }),
        deepFocus({ title: "B", dueDate: "2026-09-09T00:00:00Z" }),
        deepFocus({ title: "C", dueDate: "2026-09-10T00:00:00Z" }),
        deepFocus({ title: "D", dueDate: "2026-09-11T00:00:00Z" }),
      ],
    });

    const byDate = layout.placements.map((p) => `${p.task.title}:${p.date}`);
    expect(byDate).toEqual([
      "A:2026-09-07",
      "B:2026-09-07",
      "C:2026-09-07",
      "D:2026-09-08",
    ]);
  });

  it("counts blocks, not tasks — one two-block task consumes two of the three", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "14:00"), makeWindow(1, "05:30", "14:00")],
      tasks: [
        deepFocus({ title: "Big", estimatedBlocks: 2, dueDate: "2026-09-08T00:00:00Z" }),
        deepFocus({ title: "Small", dueDate: "2026-09-09T00:00:00Z" }),
        deepFocus({ title: "Third", dueDate: "2026-09-10T00:00:00Z" }),
      ],
    });

    expect(layout.placements.map((p) => `${p.task.title}:${p.date}`)).toEqual([
      "Big:2026-09-07",
      "Small:2026-09-07",
      "Third:2026-09-08",
    ]);
  });

  it("leaves the weekend uncapped", () => {
    const { layout } = run({
      windows: [makeWindow(5, "07:00", "16:00")],
      tasks: [
        deepFocus({ title: "A", dueDate: "2026-09-13T00:00:00Z" }),
        deepFocus({ title: "B", dueDate: "2026-09-13T01:00:00Z" }),
        deepFocus({ title: "C", dueDate: "2026-09-13T02:00:00Z" }),
        deepFocus({ title: "D", dueDate: "2026-09-13T03:00:00Z" }),
      ],
    });

    expect(layout.placements).toHaveLength(4);
    expect(layout.placements.every((p) => p.date === "2026-09-12")).toBe(true);
  });

  it("applies the cap to the weekend when weekendUncapped is off", () => {
    const { layout } = run({
      settings: makeSettings({ weekendUncapped: false }),
      windows: [makeWindow(5, "07:00", "16:00")],
      tasks: [
        deepFocus({ title: "A", dueDate: "2026-09-13T00:00:00Z" }),
        deepFocus({ title: "B", dueDate: "2026-09-13T01:00:00Z" }),
        deepFocus({ title: "C", dueDate: "2026-09-13T02:00:00Z" }),
        deepFocus({ title: "D", dueDate: "2026-09-13T03:00:00Z" }),
      ],
    });

    expect(layout.placements).toHaveLength(3);
    expect(layout.didntFit.map((t) => t.title)).toEqual(["D"]);
  });
});

describe("§6 location", () => {
  it("refuses to put a Home task in a gap the user spends at the gym", () => {
    const { layout } = run({
      windows: [makeWindow(0, "15:00", "15:30")],
      events: [
        makeEvent("2026-09-07", "14:00", "15:00", "Coaching session"),
        makeEvent("2026-09-07", "15:30", "17:00", "Team practice"),
      ],
      tasks: [makeTask({ title: "Email", location: "home" })],
    });

    expect(layout.placements).toHaveLength(0);
    expect(layout.didntFit.map((t) => t.title)).toEqual(["Email"]);
  });

  it("takes that same gap for a Gym task and marks the placement favourable", () => {
    const { layout } = run({
      windows: [makeWindow(0, "15:00", "15:30")],
      events: [
        makeEvent("2026-09-07", "14:00", "15:00", "Coaching session"),
        makeEvent("2026-09-07", "15:30", "17:00", "Team practice"),
      ],
      tasks: [makeTask({ title: "Fix the rack", location: "gym" })],
    });

    expect(layout.placements).toHaveLength(1);
    expect(layout.placements[0].locationFavourable).toBe(true);
    expect(layout.placements[0].gymAnchorStart).toBe(14 * 60);
  });

  it("leaves a desk morning after coaching open to Home work", () => {
    // Desean's real Monday: he coaches 6:00-7:15 at the gym and then stays
    // there and writes programs. Nothing follows until the afternoon.
    //
    // Treating the hours after coaching as gym time would refuse every Home
    // task and leave his best deep focus window of the week empty. The gym
    // rule is for being stuck between sessions, not for the rest of the day.
    const { layout } = run({
      windows: [makeWindow(0, "07:30", "10:30")],
      events: [
        // Tagged rather than named into it: "Elite group" contains no gym
        // keyword, so relying on the heuristic would pass for the wrong reason.
        makeEvent("2026-09-07", "06:00", "07:15", "Elite group", { atGym: true }),
        makeEvent("2026-09-07", "13:45", "14:45", "Addy Brown, private", { atGym: true }),
      ],
      tasks: [makeTask({ title: "Write SMHS volleyball block 3", location: "home" })],
    });

    expect(layout.didntFit).toHaveLength(0);
    expect(layout.placements).toHaveLength(1);
    expect(layout.placements[0].locationFavourable).toBe(false);
  });

  it("still claims the gap between two sessions on the same morning", () => {
    // The other half of the same rule: 7:30 to 8:15 sandwiched between two
    // gym commitments IS gym time, and a Home task may not go there.
    const { layout } = run({
      windows: [makeWindow(0, "07:30", "08:15")],
      events: [
        makeEvent("2026-09-07", "06:00", "07:15", "Elite group", { atGym: true }),
        makeEvent("2026-09-07", "08:30", "10:00", "Youth S&C", { atGym: true }),
      ],
      tasks: [makeTask({ title: "Email", location: "home" })],
    });

    expect(layout.placements).toHaveLength(0);
    expect(layout.didntFit.map((t) => t.title)).toEqual(["Email"]);
  });
});

describe("§14 recurring tasks wait for their week", () => {
  it("places a recurring task due inside the week", () => {
    const { layout } = run({
      windows: [makeWindow(0, "09:00", "12:00")],
      tasks: [
        makeTask({
          title: "Rent",
          isRecurring: true,
          recurrenceRule: "FREQ=MONTHLY;BYMONTHDAY=8",
          dueDate: "2026-09-08T17:00:00Z",
        }),
      ],
    });

    expect(layout.placements.map((p) => p.task.title)).toEqual(["Rent"]);
  });

  it("leaves next month's copy alone until its week comes round", () => {
    // Without this, October's rent claims the best slot of every week
    // between now and October, every single run.
    const { layout } = run({
      windows: [makeWindow(0, "09:00", "12:00")],
      tasks: [
        makeTask({
          title: "Rent",
          isRecurring: true,
          recurrenceRule: "FREQ=MONTHLY;BYMONTHDAY=8",
          dueDate: "2026-10-08T17:00:00Z",
        }),
      ],
    });

    expect(layout.placements).toHaveLength(0);
    // Nor is it overflow: it is not late, it is simply not due yet.
    expect(layout.didntFit).toHaveLength(0);
  });

  it("still places an overdue recurring task", () => {
    const { layout } = run({
      windows: [makeWindow(0, "09:00", "12:00")],
      tasks: [
        makeTask({
          title: "Rent",
          isRecurring: true,
          recurrenceRule: "FREQ=MONTHLY;BYMONTHDAY=1",
          dueDate: "2026-08-01T17:00:00Z",
        }),
      ],
    });

    expect(layout.placements.map((p) => p.task.title)).toEqual(["Rent"]);
  });

  it("places a recurring task that has no due date at all", () => {
    const { layout } = run({
      windows: [makeWindow(0, "09:00", "12:00")],
      tasks: [makeTask({ title: "Weekly review", isRecurring: true, dueDate: null })],
    });

    expect(layout.placements.map((p) => p.task.title)).toEqual(["Weekly review"]);
  });

  it("does not hold back a one-off task due later", () => {
    // The rule is about recurring tasks only. Getting ahead on ordinary
    // work is the point of the scheduler.
    const { layout } = run({
      windows: [makeWindow(0, "09:00", "12:00")],
      tasks: [makeTask({ title: "Sage Creek invoice", dueDate: "2026-10-08T17:00:00Z" })],
    });

    expect(layout.placements.map((p) => p.task.title)).toEqual(["Sage Creek invoice"]);
  });
});

describe("§7 priority", () => {
  it("places recurring tasks before anything else, whatever their impact", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:00")],
      tasks: [
        makeTask({ title: "Payroll", financialImpact: 5, dueDate: "2026-09-08T00:00:00Z" }),
        makeTask({ title: "Rent", isRecurring: true, financialImpact: 1 }),
      ],
    });

    expect(titles(layout)).toEqual(["Rent"]);
    expect(layout.recurringPlaced).toHaveLength(1);
  });

  it("ranks a closer due date above a bigger financial impact", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:00")],
      tasks: [
        makeTask({ title: "Big but distant", financialImpact: 5, dueDate: "2026-09-20T00:00:00Z" }),
        makeTask({ title: "Small but due", financialImpact: 1, dueDate: "2026-09-08T00:00:00Z" }),
      ],
    });

    expect(titles(layout)).toEqual(["Small but due"]);
  });

  it("uses financial impact to break a tie inside the same day", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:00")],
      tasks: [
        makeTask({ title: "Shelf", financialImpact: 1, dueDate: "2026-09-09T16:00:00Z" }),
        makeTask({ title: "Payroll", financialImpact: 5, dueDate: "2026-09-09T20:00:00Z" }),
      ],
    });

    expect(titles(layout)).toEqual(["Payroll"]);
  });

  it("uses category weight when due date and impact are equal", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:15")],
      tasks: [
        makeTask({ title: "Housekeeping", category: "low_priority_admin", financialImpact: 3 }),
        makeTask({ title: "Invoice", category: "high_priority_admin", financialImpact: 3 }),
      ],
    });

    expect(titles(layout)).toEqual(["Invoice"]);
  });

  it("sorts tasks with no due date last", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:00")],
      tasks: [
        makeTask({ title: "Someday", financialImpact: 5 }),
        makeTask({ title: "Dated", financialImpact: 1, dueDate: "2026-09-30T00:00:00Z" }),
      ],
    });

    expect(titles(layout)).toEqual(["Dated"]);
  });
});

describe("§8 urgency", () => {
  it("never drops an urgent task into Didn't Fit — it raises a conflict instead", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:00")],
      tasks: [
        makeTask({ title: "Rent", isRecurring: true }),
        makeTask({ title: "Payroll", dueDate: "2026-09-07T12:00:00Z", financialImpact: 5 }),
      ],
    });

    expect(layout.didntFit).toHaveLength(0);
    expect(layout.conflicts).toHaveLength(1);
    expect(layout.conflicts[0].task.title).toBe("Payroll");
  });

  it("never names a recurring task as the thing an urgent task would bump", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:00")],
      tasks: [
        makeTask({ title: "Rent", isRecurring: true }),
        makeTask({ title: "Payroll", dueDate: "2026-09-07T12:00:00Z" }),
      ],
    });

    expect(layout.conflicts[0].wouldBump).toBeNull();
  });

  it("names the lowest-priority placed task as the bump candidate", () => {
    // All three are urgent; Payroll is the least imminent of them and so is
    // the one that runs out of room.
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:30")],
      tasks: [
        makeTask({ title: "Invoices", dueDate: "2026-09-06T21:00:00Z", financialImpact: 4 }),
        makeTask({ title: "Shelf", dueDate: "2026-09-06T22:00:00Z", financialImpact: 1 }),
        makeTask({ title: "Payroll", dueDate: "2026-09-08T11:00:00Z", financialImpact: 5 }),
      ],
    });

    expect(layout.conflicts.map((c) => c.task.title)).toEqual(["Payroll"]);
    expect(layout.conflicts[0].wouldBump?.title).toBe("Shelf");
  });
});

describe("§9 placement order and walls", () => {
  it("treats every existing calendar event as an immovable wall", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "08:00")],
      // Neutral title: "Lift" would read as gym time and change the answer.
      events: [makeEvent("2026-09-07", "05:30", "07:00", "Dentist")],
      tasks: [makeTask({ title: "Payroll" })],
    });

    expect(slotOf(layout.placements[0])).toBe("2026-09-07 07:00 – 07:30");
  });

  it("ignores its own previously written events when computing walls", () => {
    const { layout } = run({
      windows: [makeWindow(0, "05:30", "06:00")],
      events: [
        makeEvent("2026-09-07", "05:30", "06:00", "[ODY] Payroll", { isOurs: true }),
      ],
      tasks: [makeTask({ title: "Payroll" })],
    });

    expect(slotOf(layout.placements[0])).toBe("2026-09-07 05:30 – 06:00");
  });

  it("does not place work in the past", () => {
    const result = scheduleWeek({
      weekStart: WEEK_START,
      tasks: [makeTask({ title: "Payroll" })],
      windows: [makeWindow(0, "05:30", "12:00")],
      overrides: [],
      events: [],
      currentBlocks: [],
      settings: makeSettings(),
      // Monday at 09:00 local.
      now: new Date("2026-09-07T16:00:00Z"),
      timeZone: TEST_TZ,
    });

    expect(slotOf(result.layout.placements[0])).toBe("2026-09-07 09:00 – 09:30");
  });

  it("skips done tasks and delegate tasks entirely", () => {
    const { layout } = run({
      tasks: [
        makeTask({ title: "Finished", status: "done" }),
        makeTask({ title: "Hand to Annie", category: "delegate", assignee: "Annie" }),
        makeTask({ title: "Payroll" }),
      ],
    });

    expect(titles(layout)).toEqual(["Payroll"]);
    expect(layout.didntFit).toHaveLength(0);
  });
});

describe("§11 re-run diff", () => {
  it("reports no changes when the layout already matches the calendar", () => {
    const payroll = makeTask({ title: "Payroll", dueDate: "2026-09-09T17:00:00Z" });
    const { diff } = run({
      tasks: [payroll],
      currentBlocks: [makeBlock(payroll.id, "2026-09-07", "05:30", "06:00")],
    });

    expect(diff.totalChanges).toBe(0);
    expect(diff.moves).toHaveLength(0);
    expect(diff.placements).toHaveLength(0);
  });

  it("writes a move as a full sentence naming the task and the reason", () => {
    const smhs = makeTask({
      title: "Write SMHS volleyball block",
      category: "deep_focus",
      dueDate: "2026-09-11T17:00:00Z",
    });
    const payroll = makeTask({
      title: "Payroll",
      dueDate: "2026-09-09T17:00:00Z",
      financialImpact: 5,
    });

    const { diff } = run({
      windows: [makeWindow(0, "09:00", "10:00"), makeWindow(3, "09:00", "11:00")],
      tasks: [smhs, payroll],
      currentBlocks: [makeBlock(smhs.id, "2026-09-07", "09:00", "09:45")],
    });

    const move = diff.moves[0];
    expect(move.title).toBe("Write SMHS volleyball block");
    const sentence = move.sentence.map((p) => p.text).join("");
    expect(sentence).toBe(
      "Moving Write SMHS volleyball block from Mon 09:00 to Thu 09:00 to make room for Payroll, due Wednesday.",
    );
    // Task names are the emphasised parts.
    expect(move.sentence.filter((p) => p.emphasis).map((p) => p.text)).toEqual([
      "Write SMHS volleyball block",
      "Payroll",
    ]);
  });

  it("writes a new placement as a sentence with day, time, length and location", () => {
    const { diff } = run({ tasks: [makeTask({ title: "Payroll" })] });

    expect(diff.placements[0].sentence.map((p) => p.text).join("")).toBe(
      "Placing Payroll Mon 05:30, 30 min, Home.",
    );
  });

  it("says out loud when a placement is driven by being at the gym", () => {
    const { diff } = run({
      windows: [makeWindow(0, "15:00", "15:30")],
      events: [
        makeEvent("2026-09-07", "14:00", "15:00", "Coaching session"),
        makeEvent("2026-09-07", "15:30", "17:00", "Team practice"),
      ],
      tasks: [makeTask({ title: "Fix the rack", location: "gym" })],
    });

    expect(diff.placements[0].sentence.map((p) => p.text).join("")).toBe(
      "Placing Fix the rack Mon 15:00, 30 min — you are at the gym from 14:00.",
    );
  });

  it("keeps recurring tasks out of the move list and counts them separately", () => {
    const rent = makeTask({ title: "Rent", isRecurring: true });
    const { diff } = run({
      windows: [makeWindow(0, "05:30", "12:00")],
      tasks: [rent],
      currentBlocks: [makeBlock(rent.id, "2026-09-07", "07:00", "07:30")],
    });

    expect(diff.moves).toHaveLength(0);
    expect(diff.placements).toHaveLength(0);
    expect(diff.recurringPlacedCount).toBe(1);
  });

  it("clears a block whose task no longer fits", () => {
    const dropped = makeTask({ title: "Reorganise the shelf" });
    const { diff } = run({
      windows: [makeWindow(0, "05:30", "06:00")],
      tasks: [
        makeTask({ title: "Payroll", dueDate: "2026-09-08T00:00:00Z", financialImpact: 5 }),
        dropped,
      ],
      currentBlocks: [makeBlock(dropped.id, "2026-09-07", "05:30", "06:00")],
    });

    expect(diff.removals.map((r) => r.title)).toEqual(["Reorganise the shelf"]);
    expect(diff.removals[0].gcalEventId).toMatch(/^gcal-/);
    expect(diff.totalChanges).toBe(2);
  });

  it("is deterministic — the same inputs twice produce the same layout", () => {
    const tasks = [
      makeTask({ title: "A" }),
      makeTask({ title: "B" }),
      deepFocus({ title: "C" }),
    ];
    const first = run({ tasks });
    const second = run({ tasks });

    expect(second.layout.placements.map(slotOf)).toEqual(
      first.layout.placements.map(slotOf),
    );
  });
});

describe("§12 overflow", () => {
  it("places what fits and lists the rest rather than dropping it silently", () => {
    const { layout, diff } = run({
      windows: [makeWindow(0, "05:30", "06:30")],
      tasks: [
        makeTask({ title: "A", dueDate: "2026-09-08T00:00:00Z" }),
        makeTask({ title: "B", dueDate: "2026-09-09T00:00:00Z" }),
        makeTask({ title: "C", dueDate: "2026-09-10T00:00:00Z" }),
        makeTask({ title: "D", dueDate: "2026-09-11T00:00:00Z" }),
      ],
    });

    expect(titles(layout)).toEqual(["A", "B"]);
    expect(diff.didntFit.map((t) => t.title)).toEqual(["C", "D"]);
  });
});

describe("target week", () => {
  it("reports no open slots once the week is spent", () => {
    // Sunday evening: the whole Mon-start week is behind us and Sunday's
    // window has closed, so there is nowhere left to place anything.
    const result = scheduleWeek({
      weekStart: WEEK_START,
      tasks: [makeTask({ title: "Payroll" })],
      windows: [makeWindow(6, "08:00", "11:00")],
      overrides: [],
      events: [],
      currentBlocks: [],
      settings: makeSettings(),
      // Sunday 2026-09-13 at 21:00 local, past the 08:00-11:00 window.
      now: new Date("2026-09-14T04:00:00Z"),
      timeZone: TEST_TZ,
    });

    expect(result.slots).toHaveLength(0);
    expect(result.layout.placements).toHaveLength(0);
  });

  it("still reports open slots while the week has time left", () => {
    const result = scheduleWeek({
      weekStart: WEEK_START,
      tasks: [makeTask({ title: "Payroll" })],
      windows: [makeWindow(6, "08:00", "11:00")],
      overrides: [],
      events: [],
      currentBlocks: [],
      settings: makeSettings(),
      // Sunday morning, before the window opens.
      now: new Date("2026-09-13T13:00:00Z"),
      timeZone: TEST_TZ,
    });

    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.layout.placements).toHaveLength(1);
  });
});

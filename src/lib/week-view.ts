import "server-only";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { getSettingsCached, listTasksCached } from "@/lib/data/cached";
import { CATEGORIES } from "@/lib/domain/categories";
import {
  addDays,
  isoDate,
  minutesOfDay,
  parseClock,
} from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";
import { toWalls } from "@/lib/scheduler";
import { eventIsAtGym } from "@/lib/scheduler/location";
import type { WeekDay, WeekEntry, WeekView } from "@/lib/view-types";
import { wallsForWeek } from "@/lib/walls";

export type { WeekDay, WeekEntry, WeekView };
export {
  DAY_END_MINUTES,
  DAY_SPAN_MINUTES,
  DAY_START_MINUTES,
} from "@/lib/view-types";

const LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export async function loadWeekView(
  weekStart: string,
  now = new Date(),
): Promise<WeekView> {
  // Every read is a round trip to the database, so they all go together.
  // Sequential awaits here used to cost three trips before a pixel rendered.
  const repo = repository();
  const [blocks, tasks, settings, windows, events, pending] = await Promise.all([
    repo.listBlocks(weekStart),
    listTasksCached(),
    getSettingsCached(),
    repo.listWindows(),
    wallsForWeek(weekStart),
    repo.getPendingSchedule(weekStart),
  ]);

  const walls = toWalls(
    events.filter((event) => !event.isOurs),
    CALENDAR_TIME_ZONE,
    eventIsAtGym,
  );

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const today = isoDate(now, CALENDAR_TIME_ZONE);

  const days: WeekDay[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const date = addDays(weekStart, dayIndex);

    const lockedEntries: WeekEntry[] = walls
      .filter((wall) => wall.date === date)
      .map((wall) => ({
        taskId: null,
        title: wall.summary,
        category: null,
        start: wall.start,
        end: wall.end,
        locked: true,
        isReset: false,
        urgent: false,
        location: wall.atGym ? ("gym" as const) : null,
        done: false,
      }));

    // SCHEDULER_RULES §3: a NO WORK window is closed time. It never had a
    // reason attached, so the calendar could not show why the day had a hole
    // in it. A named one now appears as its own locked row.
    const closedEntries: WeekEntry[] = windows
      .filter(
        (window) =>
          window.weekday === dayIndex &&
          window.allowance === "no_work" &&
          !!window.label?.trim(),
      )
      .map((window) => ({
        taskId: null,
        title: window.label!.trim(),
        category: null,
        start: parseClock(window.startTime),
        end: parseClock(window.endTime),
        locked: true,
        isReset: false,
        urgent: false,
        location: null,
        done: false,
      }));

    const blockEntries: WeekEntry[] = blocks
      .filter((block) => isoDate(new Date(block.startTime), CALENDAR_TIME_ZONE) === date)
      .map((block) => {
        const task = block.taskId ? byId.get(block.taskId) : undefined;
        return {
          taskId: block.taskId,
          title: block.isResetGap ? "Reset" : (task?.title ?? "Block"),
          category: task?.category ?? null,
          start: minutesOfDay(new Date(block.startTime), CALENDAR_TIME_ZONE),
          end: minutesOfDay(new Date(block.endTime), CALENDAR_TIME_ZONE),
          locked: false,
          isReset: block.isResetGap,
          urgent: task ? isTaskUrgent(task, now) : false,
          location: task?.location ?? null,
          done: task?.status === "done",
        };
      });

    // What the template gives you that nothing has claimed yet. Without
    // these a day with no schedule run reads as empty, when really it is
    // three hours of deep focus waiting to be filled.
    const taken = [...lockedEntries, ...closedEntries, ...blockEntries].map((entry) => ({
      start: entry.start,
      end: entry.end,
    }));

    const freeEntries: WeekEntry[] = windows
      .filter((window) => window.weekday === dayIndex && window.allowance !== "no_work")
      .flatMap((window) =>
        subtract(parseClock(window.startTime), parseClock(window.endTime), taken).map(
          ([start, end]) => ({
            taskId: null,
            title: window.label?.trim() || ALLOWANCE_TITLE[window.allowance],
            category: null,
            start,
            end,
            locked: false,
            isReset: false,
            urgent: false,
            location: null,
            done: false,
            isFree: true,
            allowance: window.allowance,
          }),
        ),
      );

    const entries = [
      ...lockedEntries,
      ...closedEntries,
      ...blockEntries,
      ...freeEntries,
    ].sort((a, b) => a.start - b.start || a.end - b.end);
    const work = entries.filter(
      (entry) => !entry.locked && !entry.isReset && !entry.isFree,
    );

    const templateMinutes = windows
      .filter((w) => w.weekday === dayIndex && w.allowance !== "no_work")
      .reduce((total, w) => total + (parseClock(w.endTime) - parseClock(w.startTime)), 0);

    const lockedMinutes = lockedEntries.reduce((t, e) => t + (e.end - e.start), 0);
    const scheduledMinutes = work.reduce((t, e) => t + (e.end - e.start), 0);

    days.push({
      dayIndex,
      date,
      label: LABELS[dayIndex],
      isToday: date === today,
      entries,
      lockedMinutes,
      scheduledMinutes,
      openMinutes: Math.max(0, templateMinutes - scheduledMinutes),
      deepFocusBlocks: work
        .filter((entry) => entry.category === "deep_focus")
        .reduce(
          (total, entry) =>
            total + Math.round((entry.end - entry.start) / CATEGORIES.deep_focus.blockMinutes!),
          0,
        ),
      blockCount: work.length,
      resetCount: entries.filter((entry) => entry.isReset).length,
    });
  }

  return {
    weekStart,
    days,
    deepFocusCap: settings.deepFocusCap,
    weekendUncapped: settings.weekendUncapped,
    didntFit: tasks.filter(
      (task) =>
        task.status === "backlog" &&
        CATEGORIES[task.category].schedules &&
        blocks.every((block) => block.taskId !== task.id),
    ),
    nowMinutes: minutesOfDay(now, CALENDAR_TIME_ZONE),
    todayIndex: days.findIndex((day) => day.date === today) >= 0
      ? days.findIndex((day) => day.date === today)
      : null,
    hasPending: pending !== null,
  };
}

function isTaskUrgent(task: Task, now: Date): boolean {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate).getTime() <= now.getTime() + 48 * 3_600_000;
}

/** The fallback name for an unlabelled window, by what it accepts. */
const ALLOWANCE_TITLE: Record<string, string> = {
  any: "Open",
  deep_focus: "Deep focus",
  admin_only: "Admin",
  no_work: "Closed",
};

/**
 * `[start, end)` with every interval in `busy` removed, as the pieces that
 * survive. Used to find the part of a window nothing has claimed.
 *
 * A leftover under 5 minutes is dropped: it is a rounding artefact, not time
 * anyone can use, and rendering it would litter the day with slivers.
 */
function subtract(
  start: number,
  end: number,
  busy: { start: number; end: number }[],
): [number, number][] {
  const overlapping = busy
    .filter((slot) => slot.end > start && slot.start < end)
    .sort((a, b) => a.start - b.start);

  const pieces: [number, number][] = [];
  let cursor = start;

  for (const slot of overlapping) {
    if (slot.start > cursor) pieces.push([cursor, Math.min(slot.start, end)]);
    cursor = Math.max(cursor, slot.end);
    if (cursor >= end) break;
  }
  if (cursor < end) pieces.push([cursor, end]);

  return pieces.filter(([from, to]) => to - from >= 5);
}

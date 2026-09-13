import "server-only";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { subtract, type Span } from "@/lib/domain/intervals";
import { isoDate, minutesOfDay, parseClock } from "@/lib/domain/time";
import type { WindowAllowance } from "@/lib/domain/types";
import { wallsForRange } from "@/lib/walls";
import { addDays } from "@/lib/domain/time";

/** One tappable row in the "put it where?" sheet. */
export interface DaySlot {
  /** Minutes from local midnight. */
  start: number;
  end: number;
  /** The window's own name, or what it accepts when it has none. */
  label: string;
  allowance: WindowAllowance;
  /**
   * What is already here. Empty means free. Non-empty is still offered —
   * §11 warns rather than blocks — and the sheet flags it.
   */
  occupiedBy: string[];
}

const ALLOWANCE_TITLE: Record<WindowAllowance, string> = {
  any: "Open",
  deep_focus: "Deep focus",
  admin_only: "Admin",
  no_work: "Closed",
};

/**
 * Every place a task could go on `date`, in order.
 *
 * Built from the week template, so it only ever offers time the user said
 * was theirs. Closed windows are left out entirely: the user can still put
 * work there by editing the template, and offering closed time in a picker
 * would quietly undo the point of marking it closed.
 */
export async function loadDaySlots(date: string): Promise<DaySlot[]> {
  const repo = repository();
  const weekday = weekdayOf(date);

  const [windows, blocks, tasks, walls] = await Promise.all([
    repo.listWindows(),
    repo.listBlocksBetween(
      startOfDay(date).toISOString(),
      startOfDay(addDays(date, 1)).toISOString(),
    ),
    repo.listTasks(),
    wallsForRange(date, addDays(date, 1)),
  ]);

  const byId = new Map(tasks.map((task) => [task.id, task]));

  // Calendar and commitments: not offerable at all, and they carve the
  // window up the same way a scheduled block does.
  const wallSpans: (Span & { title: string })[] = walls
    .filter((event) => !event.isOurs)
    .map((event) => ({
      start: minutesOfDay(new Date(event.start), CALENDAR_TIME_ZONE),
      end: minutesOfDay(new Date(event.end), CALENDAR_TIME_ZONE),
      title: event.summary,
    }));

  const blockSpans: (Span & { title: string })[] = blocks
    .filter((block) => !block.isResetGap)
    .map((block) => ({
      start: minutesOfDay(new Date(block.startTime), CALENDAR_TIME_ZONE),
      end: minutesOfDay(new Date(block.endTime), CALENDAR_TIME_ZONE),
      title: block.taskId ? (byId.get(block.taskId)?.title ?? "Block") : "Delegation",
    }));

  const slots: DaySlot[] = [];

  for (const window of windows) {
    if (window.weekday !== weekday || window.allowance === "no_work") continue;

    const from = parseClock(window.startTime);
    const to = parseClock(window.endTime);
    const label = window.label?.trim() || ALLOWANCE_TITLE[window.allowance];

    // The parts nothing has claimed, offered first and unflagged.
    for (const free of subtract(from, to, [...wallSpans, ...blockSpans])) {
      slots.push({ ...free, label, allowance: window.allowance, occupiedBy: [] });
    }

    // The parts a task already holds, offered with a warning. A wall is not
    // offered: the user is genuinely elsewhere, and the app has no business
    // suggesting they double-book coaching.
    for (const taken of blockSpans) {
      if (taken.end <= from || taken.start >= to) continue;
      const start = Math.max(from, taken.start);
      const end = Math.min(to, taken.end);
      const buriedInWall = wallSpans.some(
        (wall) => wall.start < end && start < wall.end,
      );
      if (buriedInWall) continue;
      slots.push({
        start,
        end,
        label,
        allowance: window.allowance,
        occupiedBy: [taken.title],
      });
    }
  }

  return slots.sort((a, b) => a.start - b.start || a.end - b.end);
}

function startOfDay(date: string): Date {
  // Midday then floored to the date avoids the DST edge where a local
  // midnight does not exist.
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/** 0 = Monday, read off the date string so no timezone is involved. */
function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return (Date.UTC(year, month - 1, day) / 86_400_000 + 3) % 7;
}

/** Today, in the app's timezone. */
export function todayIso(now = new Date()): string {
  return isoDate(now, CALENDAR_TIME_ZONE);
}

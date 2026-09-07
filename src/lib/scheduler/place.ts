import { blockMinutes, categoryMeta } from "@/lib/domain/categories";
import { byPriority, comparePriority, isUrgent } from "@/lib/domain/priority";
import { addDays, isoDate } from "@/lib/domain/time";
import type { SchedulerSettings, Task } from "@/lib/domain/types";
import type { OpenAllowance, Slot, Wall } from "./availability";
import {
  gymAnchor,
  inferLocation,
  locationAllows,
  locationIsFavourable,
} from "./location";

/**
 * Work, in minutes, that earns a reset. SCHEDULER_RULES §4: one 45-minute
 * Deep Focus block earns one, and so do two consecutive 30-minute blocks.
 */
export const RESET_THRESHOLD_MINUTES = 45;

export interface Placement {
  taskId: string;
  task: Task;
  dayIndex: number;
  date: string;
  /** Minutes since local midnight. */
  start: number;
  end: number;
  blocks: number;
  /** True when the task is at the gym and so is the user. */
  locationFavourable: boolean;
  /** The gym commitment that makes it favourable, for the diff sentence. */
  gymAnchorStart: number | null;
}

export interface ResetGap {
  dayIndex: number;
  date: string;
  start: number;
  end: number;
}

export interface Conflict {
  task: Task;
  /** The placed task this urgent item would have to bump. Null if nothing can. */
  wouldBump: Task | null;
  wouldBumpPlacement: Placement | null;
}

export interface Layout {
  placements: Placement[];
  resets: ResetGap[];
  /** Overflow. Urgent tasks are never here — they become conflicts (§8). */
  didntFit: Task[];
  conflicts: Conflict[];
  /** Recurring tasks placed first and never listed in a diff (§11). */
  recurringPlaced: Placement[];
}

export interface PlanInput {
  weekStart: string;
  tasks: Task[];
  slots: Slot[];
  walls: Wall[];
  settings: SchedulerSettings;
  now: Date;
  timeZone: string;
}

interface SlotCursor {
  slot: Slot;
  /** Next free minute inside the slot. */
  cursor: number;
  /** Minutes worked since the last reset gap, within this slot. */
  workSinceReset: number;
}

/**
 * SCHEDULER_RULES §9. Produce the ideal layout for the week. This function is
 * pure: same inputs, same output, no I/O, nothing written anywhere.
 */
export function planWeek(input: PlanInput): Layout {
  const { tasks, slots, walls, settings, now, timeZone } = input;

  // §14 places recurring tasks first, before anything else is considered.
  // That is right for the one due this week and wrong for the one due next
  // month: without this, next month's rent would claim the best slot of
  // every week between now and then. A recurring task waits until the week
  // it is actually due in. Overdue still counts, and a recurring task with
  // no due date has no future to wait for, so both stay in.
  const weekEnd = addDays(input.weekStart, 7);
  const schedulable = tasks.filter((task) => {
    if (task.status === "done" || !categoryMeta(task.category).schedules) return false;
    if (!task.isRecurring || !task.dueDate) return true;
    return isoDate(new Date(task.dueDate), timeZone) < weekEnd;
  });

  const cursors: SlotCursor[] = slots.map((slot) => ({
    slot,
    cursor: slot.start,
    workSinceReset: 0,
  }));

  const deepFocusBlocksByDate = new Map<string, number>();
  const placements: Placement[] = [];
  const resets: ResetGap[] = [];
  const unplaced: Task[] = [];

  // Recurring first, then computed priority order (§9.3, §9.4).
  for (const task of byPriority(schedulable, now, timeZone)) {
    const placed = placeTask(task, cursors, walls, settings, deepFocusBlocksByDate, resets);
    if (placed) {
      placements.push(placed);
    } else {
      unplaced.push(task);
    }
  }

  // §8: an urgent task may never land in Didn't Fit.
  const conflicts: Conflict[] = [];
  const didntFit: Task[] = [];

  for (const task of unplaced) {
    if (isUrgent(task, now)) {
      conflicts.push(buildConflict(task, placements, settings, now, timeZone));
    } else {
      didntFit.push(task);
    }
  }

  placements.sort(byStartTime);
  resets.sort(byStartTime);

  return {
    placements,
    resets,
    didntFit,
    conflicts,
    recurringPlaced: placements.filter((p) => p.task.isRecurring),
  };
}

function placeTask(
  task: Task,
  cursors: SlotCursor[],
  walls: Wall[],
  settings: SchedulerSettings,
  deepFocusBlocksByDate: Map<string, number>,
  resets: ResetGap[],
): Placement | null {
  const unit = blockMinutes(task.category);
  const duration = unit * task.estimatedBlocks;
  const isDeepFocus = task.category === "deep_focus";

  for (const entry of cursors) {
    const { slot } = entry;

    if (!allowanceAccepts(slot.allowance, isDeepFocus)) continue;

    if (isDeepFocus && exceedsDeepFocusCap(slot, task, settings, deepFocusBlocksByDate)) {
      continue;
    }

    // A reset earned by earlier work in this slot is taken before the next
    // task starts — never inside one (§4).
    const needsReset = entry.workSinceReset >= RESET_THRESHOLD_MINUTES;
    const resetLength = needsReset ? settings.resetMinutes : 0;
    const start = entry.cursor + resetLength;
    const end = start + duration;

    if (end > slot.end) continue;

    const inferred = inferLocation(walls, slot.date, start, end);
    if (!locationAllows(inferred, task.location)) continue;

    if (needsReset) {
      resets.push({
        dayIndex: slot.dayIndex,
        date: slot.date,
        start: entry.cursor,
        end: start,
      });
      entry.workSinceReset = 0;
    }

    entry.cursor = end;
    entry.workSinceReset += duration;

    if (isDeepFocus) {
      deepFocusBlocksByDate.set(
        slot.date,
        (deepFocusBlocksByDate.get(slot.date) ?? 0) + task.estimatedBlocks,
      );
    }

    const anchor = gymAnchor(walls, slot.date, start, end);

    return {
      taskId: task.id,
      task,
      dayIndex: slot.dayIndex,
      date: slot.date,
      start,
      end,
      blocks: task.estimatedBlocks,
      locationFavourable: locationIsFavourable(inferred, task.location),
      gymAnchorStart: anchor ? anchor.start : null,
    };
  }

  return null;
}

function allowanceAccepts(allowance: OpenAllowance, isDeepFocus: boolean): boolean {
  if (allowance === "any") return true;
  if (allowance === "deep_focus") return isDeepFocus;
  return !isDeepFocus; // admin_only
}

/** §5. The cap counts blocks, not tasks, and the weekend may be uncapped. */
function exceedsDeepFocusCap(
  slot: Slot,
  task: Task,
  settings: SchedulerSettings,
  used: Map<string, number>,
): boolean {
  const isWeekend = slot.dayIndex >= 5;
  if (isWeekend && settings.weekendUncapped) return false;
  const already = used.get(slot.date) ?? 0;
  return already + task.estimatedBlocks > settings.deepFocusCap;
}

/**
 * §8. Name what the urgent task would have to bump: the lowest-priority
 * placed, non-recurring task whose slot is big enough to host it. Recurring
 * tasks are never bumped (§7.1).
 */
function buildConflict(
  task: Task,
  placements: Placement[],
  settings: SchedulerSettings,
  now: Date,
  timeZone: string,
): Conflict {
  const needed = blockMinutes(task.category) * task.estimatedBlocks;
  const isDeepFocus = task.category === "deep_focus";

  const bumpable = placements
    .filter((p) => !p.task.isRecurring)
    .sort((a, b) => comparePriority(b.task, a.task, now, timeZone)); // worst first

  const roomy = bumpable.find(
    (p) => p.end - p.start >= needed && (!isDeepFocus || p.dayIndex >= 5 || settings.deepFocusCap > 0),
  );

  const candidate = roomy ?? bumpable[0] ?? null;

  return {
    task,
    wouldBump: candidate ? candidate.task : null,
    wouldBumpPlacement: candidate ?? null,
  };
}

function byStartTime(
  a: { dayIndex: number; start: number },
  b: { dayIndex: number; start: number },
): number {
  return a.dayIndex - b.dayIndex || a.start - b.start;
}

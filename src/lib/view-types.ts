/**
 * Shapes shared between the server loaders and the client screens.
 *
 * They live apart from `week-view.ts` / `today-view.ts` because those are
 * `server-only`, and a client component importing one — even for a type —
 * pulls the whole module into the browser bundle and fails the build.
 */
import type { Task, TaskCategory } from "@/lib/domain/types";

/** The load meter's canvas: a 06:00–22:00 day. */
export const DAY_START_MINUTES = 6 * 60;
export const DAY_END_MINUTES = 22 * 60;
export const DAY_SPAN_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;

/**
 * How long after a block ends the close-out bar stays up. Long enough to
 * catch it after walking off the floor, short enough not to nag.
 */
export const CLOSE_OUT_GRACE_MINUTES = 20;

export interface WeekEntry {
  /** Null for a locked calendar event and for reset gaps. */
  taskId: string | null;
  title: string;
  category: TaskCategory | null;
  start: number;
  end: number;
  locked: boolean;
  isReset: boolean;
  urgent: boolean;
  location: "gym" | "home" | null;
  done: boolean;
}

export interface WeekDay {
  dayIndex: number;
  date: string;
  label: string;
  isToday: boolean;
  entries: WeekEntry[];
  lockedMinutes: number;
  scheduledMinutes: number;
  openMinutes: number;
  deepFocusBlocks: number;
  blockCount: number;
  resetCount: number;
}

export interface WeekView {
  weekStart: string;
  days: WeekDay[];
  deepFocusCap: number;
  weekendUncapped: boolean;
  /** Still in the backlog after the last run: the overflow (§12). */
  didntFit: Task[];
  nowMinutes: number;
  todayIndex: number | null;
  hasPending: boolean;
}

export interface TodayView {
  date: string;
  dayIndex: number;
  entries: WeekEntry[];
  nowMinutes: number;
  blocksLeft: number;
  /** The block that is live, or has just ended and is still unclosed. */
  activeEntry: WeekEntry | null;
  activeIsLive: boolean;
  /** Urgent tasks with nowhere on the calendar yet (§8). */
  urgentUnplaced: Task[];
  /** Everything open, for the swap picker inside the close-out sheet. */
  swapCandidates: Task[];
  /**
   * The next scheduled block after today, when there is one. Today can be
   * legitimately empty while the week ahead is full — saying so beats
   * telling the user to run something they already ran.
   */
  nextUp: { title: string; date: string; dayIndex: number; start: number } | null;
}

/* ------------------------------------------------------------------ month */

export interface MonthDay {
  date: string;
  dayOfMonth: number;
  /** False for the leading and trailing days that pad the grid. */
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  /** Scheduled blocks, excluding resets. */
  blockCount: number;
  /** Existing calendar commitments. */
  lockedCount: number;
  deepFocusBlocks: number;
  /** Distinct category colours present, in display order, for the dots. */
  categories: TaskCategory[];
  entries: WeekEntry[];
}

export interface MonthView {
  /** `YYYY-MM-01`. */
  monthStart: string;
  label: string;
  /** Whole weeks, Monday first, padded either side. */
  weeks: MonthDay[][];
  /** The day to select on open: today, or the first of the month. */
  initialDate: string;
  isCurrentMonth: boolean;
}

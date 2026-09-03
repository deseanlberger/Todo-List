import { categoryMeta } from "./categories";
import { DEFAULT_TIME_ZONE, daysBetween, isoDate } from "./time";
import type { Task } from "./types";

export const URGENT_WINDOW_HOURS = 48;

/**
 * SCHEDULER_RULES §8. Urgency is derived from the due date, never stored and
 * never typed in by the user.
 */
export function isUrgent(task: Task, now: Date): boolean {
  if (task.status === "done" || !task.dueDate) return false;
  const due = new Date(task.dueDate).getTime();
  return due <= now.getTime() + URGENT_WINDOW_HOURS * 3_600_000;
}

/** Hours until due. `Infinity` when there is no due date. */
export function hoursUntilDue(task: Task, now: Date): number {
  if (!task.dueDate) return Infinity;
  return (new Date(task.dueDate).getTime() - now.getTime()) / 3_600_000;
}

/** `URGENT · DUE IN 9H` — the task-detail urgency label. */
export function urgencyLabel(task: Task, now: Date): string | null {
  if (!isUrgent(task, now)) return null;
  const hours = hoursUntilDue(task, now);
  if (hours < 0) return "URGENT · OVERDUE";
  if (hours < 1) return "URGENT · DUE WITHIN THE HOUR";
  return `URGENT · DUE IN ${Math.round(hours)}H`;
}

/**
 * SCHEDULER_RULES §7. Ranking is computed, never typed in. The inputs are
 * listed there in order of *authority*, so this is a lexicographic comparator
 * rather than a weighted sum — a weighted sum would let a big financial
 * impact quietly outrank a recurring task.
 *
 * One deliberate softening: due proximity compares whole days, not exact
 * timestamps. Comparing timestamps would mean two tasks due the same
 * afternoon are ordered by minute, and financial impact would never get to
 * decide anything.
 *
 * Returns < 0 when `a` should be placed first.
 */
export function comparePriority(
  a: Task,
  b: Task,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): number {
  // 1. Recurring always ranks above everything else.
  if (a.isRecurring !== b.isRecurring) return a.isRecurring ? -1 : 1;

  // 2. Due date proximity, bucketed to the calendar day. No date sorts last.
  const dayA = dueDayBucket(a, now, timeZone);
  const dayB = dueDayBucket(b, now, timeZone);
  if (dayA !== dayB) return dayA - dayB;

  // 3. Financial impact, 1-5. Higher first.
  if (a.financialImpact !== b.financialImpact) {
    return b.financialImpact - a.financialImpact;
  }

  // 4. Category weight. Deep Focus and High Priority Admin outrank the rest.
  const weightA = categoryMeta(a.category).weight;
  const weightB = categoryMeta(b.category).weight;
  if (weightA !== weightB) return weightB - weightA;

  // Stable fallback so a re-run with unchanged inputs produces an identical
  // layout and therefore an empty diff.
  return a.id.localeCompare(b.id);
}

/**
 * Days from today to the task's due date, in the user's timezone.
 *
 * Deliberately the *calendar* day rather than `hoursUntilDue / 24`: two tasks
 * due the same afternoon must land in the same bucket so financial impact
 * gets to decide between them. Bucketing by elapsed hours would split them
 * across a 72-hour boundary and silently make impact dead weight.
 */
function dueDayBucket(task: Task, now: Date, timeZone: string): number {
  if (!task.dueDate) return Number.MAX_SAFE_INTEGER;
  return daysBetween(isoDate(now, timeZone), isoDate(new Date(task.dueDate), timeZone));
}

/** Placement order for the scheduler: highest priority first. */
export function byPriority(
  tasks: Task[],
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): Task[] {
  return [...tasks].sort((a, b) => comparePriority(a, b, now, timeZone));
}

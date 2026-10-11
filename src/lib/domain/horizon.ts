import { addDays, isoDate } from "./time";
import type { Task } from "./types";

/**
 * How far ahead counts as "now".
 *
 * A week, because the work runs in weeks: a program block, a payroll
 * window, an invoice. Seven days still leaves runway on a Friday deadline
 * instead of dropping it on him Friday morning.
 */
export const HORIZON_DAYS = 7;

/**
 * The calendar day a due date lands on where he lives.
 *
 * Not `dueDate.slice(0, 10)`, which is the UTC day: anything due after 5pm
 * Pacific is already tomorrow in UTC, so slicing would call a task due
 * tonight "tomorrow" and, at the far end of the window, push a task one day
 * past the horizon that belongs inside it.
 */
export function dueDay(task: Task, timeZone: string): string | null {
  if (!task.dueDate) return null;
  const at = new Date(task.dueDate);
  if (Number.isNaN(at.getTime())) return null;
  return isoDate(at, timeZone);
}

/**
 * Split what he can act on from what he cannot act on yet.
 *
 * A task dated three weeks out is not work, it is a reminder that work is
 * coming, and reading past it every time he opens the app is a tax. It goes
 * behind one tap instead.
 *
 * Undated tasks stay in `now`: nothing is stopping him from doing those.
 */
export function partitionByHorizon(
  tasks: Task[],
  today: string,
  timeZone: string,
  days: number = HORIZON_DAYS,
): { now: Task[]; later: Task[] } {
  const horizon = addDays(today, days);
  const now: Task[] = [];
  const later: Task[] = [];

  for (const task of tasks) {
    const day = dueDay(task, timeZone);
    if (day && day > horizon) later.push(task);
    else now.push(task);
  }

  return { now, later };
}

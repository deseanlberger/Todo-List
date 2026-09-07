import "server-only";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { wallsForRange } from "@/lib/walls";
import { CATEGORY_ORDER, CATEGORIES } from "@/lib/domain/categories";
import {
  addDays,
  addMonths,
  daysInMonth,
  formatMonthLong,
  isoDate,
  minutesOfDay,
  weekOf,
} from "@/lib/domain/time";
import type { TaskCategory } from "@/lib/domain/types";
import { minutesToInstant, toWalls } from "@/lib/scheduler";
import { eventIsAtGym } from "@/lib/scheduler/location";
import type { MonthDay, MonthView, WeekEntry } from "@/lib/view-types";

export { addMonths };

/**
 * A month of days, padded to whole Monday-start weeks, each carrying enough
 * to draw its dots and to open its agenda without a second round trip.
 */
export async function loadMonthView(
  monthStart: string,
  now = new Date(),
): Promise<MonthView> {
  const repo = repository();
  const today = isoDate(now, CALENDAR_TIME_ZONE);

  // Pad out to whole weeks so the grid has no ragged first or last row.
  const gridStart = weekOf(
    minutesToInstant(monthStart, 12 * 60, CALENDAR_TIME_ZONE),
    CALENDAR_TIME_ZONE,
  );
  const lastDay = addDays(monthStart, daysInMonth(monthStart) - 1);
  const gridEndExclusive = addDays(
    weekOf(minutesToInstant(lastDay, 12 * 60, CALENDAR_TIME_ZONE), CALENDAR_TIME_ZONE),
    7,
  );

  const [blocks, tasks, events] = await Promise.all([
    repo.listBlocksBetween(
      minutesToInstant(gridStart, 0, CALENDAR_TIME_ZONE).toISOString(),
      minutesToInstant(gridEndExclusive, 0, CALENDAR_TIME_ZONE).toISOString(),
    ),
    repo.listTasks(),
    wallsForRange(gridStart, gridEndExclusive),
  ]);

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const walls = toWalls(
    events.filter((event) => !event.isOurs),
    CALENDAR_TIME_ZONE,
    eventIsAtGym,
  );

  const days: MonthDay[] = [];
  for (let date = gridStart; date < gridEndExclusive; date = addDays(date, 1)) {
    const locked: WeekEntry[] = walls
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

    const scheduled: WeekEntry[] = blocks
      .filter(
        (block) => isoDate(new Date(block.startTime), CALENDAR_TIME_ZONE) === date,
      )
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
          urgent: false,
          location: task?.location ?? null,
          done: task?.status === "done",
        };
      });

    const entries = [...locked, ...scheduled].sort((a, b) => a.start - b.start);
    const work = entries.filter((entry) => !entry.locked && !entry.isReset);
    const present = new Set(
      work.map((entry) => entry.category).filter(Boolean) as TaskCategory[],
    );

    days.push({
      date,
      dayOfMonth: Number(date.slice(8, 10)),
      inMonth: date.slice(0, 7) === monthStart.slice(0, 7),
      isToday: date === today,
      isPast: date < today,
      blockCount: work.length,
      lockedCount: locked.length,
      deepFocusBlocks: work
        .filter((entry) => entry.category === "deep_focus")
        .reduce(
          (total, entry) =>
            total +
            Math.round((entry.end - entry.start) / CATEGORIES.deep_focus.blockMinutes!),
          0,
        ),
      // Fixed order, so the dots do not reshuffle between days.
      categories: CATEGORY_ORDER.filter((category) => present.has(category)),
      entries,
    });
  }

  const weeks: MonthDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  const isCurrentMonth = today.slice(0, 7) === monthStart.slice(0, 7);

  return {
    monthStart,
    label: formatMonthLong(monthStart),
    weeks,
    initialDate: isCurrentMonth ? today : monthStart,
    isCurrentMonth,
  };
}

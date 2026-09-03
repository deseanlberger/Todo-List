import "server-only";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { CATEGORIES } from "@/lib/domain/categories";
import { isUrgent } from "@/lib/domain/priority";
import { isoDate, minutesOfDay } from "@/lib/domain/time";
import { currentWeekStart } from "@/lib/schedule-run";
import { CLOSE_OUT_GRACE_MINUTES, type TodayView } from "@/lib/view-types";
import { loadWeekView } from "@/lib/week-view";

export type { TodayView };
export { CLOSE_OUT_GRACE_MINUTES };

export async function loadTodayView(now = new Date()): Promise<TodayView> {
  const week = await loadWeekView(currentWeekStart(now), now);
  const today = isoDate(now, CALENDAR_TIME_ZONE);
  const day = week.days.find((entry) => entry.date === today);
  const nowMinutes = minutesOfDay(now, CALENDAR_TIME_ZONE);

  const entries = day?.entries ?? [];
  const work = entries.filter((entry) => !entry.locked && !entry.isReset && !entry.done);

  const live = work.find(
    (entry) => entry.start <= nowMinutes && entry.end > nowMinutes,
  );
  const justEnded = work
    .filter(
      (entry) =>
        entry.end <= nowMinutes && entry.end > nowMinutes - CLOSE_OUT_GRACE_MINUTES,
    )
    .sort((a, b) => b.end - a.end)[0];

  const tasks = await repository().listTasks();
  const placedToday = new Set(entries.map((entry) => entry.taskId).filter(Boolean));

  return {
    date: today,
    dayIndex: day?.dayIndex ?? 0,
    entries,
    nowMinutes,
    blocksLeft: work.filter((entry) => entry.end > nowMinutes).length,
    activeEntry: live ?? justEnded ?? null,
    activeIsLive: Boolean(live),
    urgentUnplaced: tasks.filter(
      (task) =>
        task.status === "backlog" &&
        CATEGORIES[task.category].schedules &&
        isUrgent(task, now) &&
        !placedToday.has(task.id),
    ),
    swapCandidates: tasks.filter(
      (task) => task.status !== "done" && CATEGORIES[task.category].schedules,
    ),
  };
}

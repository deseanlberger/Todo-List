import "server-only";
import { CALENDAR_TIME_ZONE, calendar, eventPrefix } from "@/lib/calendar";
import { repository, type PendingSchedule } from "@/lib/data";
import { categoryMeta } from "@/lib/domain/categories";
import { addDays, weekOf as weekOfDate } from "@/lib/domain/time";
import type { ScheduledBlock, Task } from "@/lib/domain/types";
import {
  minutesToInstant,
  scheduleWeek,
  type Layout,
  type ScheduleDiff,
} from "@/lib/scheduler";

export type PendingBlock = Omit<ScheduledBlock, "id" | "userId" | "createdAt">;

export interface WeekComputation {
  weekStart: string;
  layout: Layout;
  diff: ScheduleDiff;
  blocks: PendingBlock[];
}

/** The Monday of the week we are currently working in. */
export function currentWeekStart(now = new Date()): string {
  return weekOfDate(now, CALENDAR_TIME_ZONE);
}

/**
 * Read the calendar, read the template, compute the ideal week, diff it.
 * Writes nothing anywhere — that is `approveWeek`.
 */
export async function computeWeek(
  weekStart: string,
  now = new Date(),
): Promise<WeekComputation> {
  const repo = repository();

  const [tasks, windows, settings, currentBlocks] = await Promise.all([
    repo.listTasks(),
    repo.listWindows(),
    repo.getSettings(),
    repo.listBlocks(weekStart),
  ]);

  const overrides = await repo.listOverrides(weekStart, addDays(weekStart, 6));

  // §9.1: the calendar is read first, always.
  const events = await calendar().listWeek(weekStart, CALENDAR_TIME_ZONE);

  const { layout, diff } = scheduleWeek({
    weekStart,
    tasks,
    windows,
    overrides,
    events,
    currentBlocks,
    settings,
    now,
    timeZone: CALENDAR_TIME_ZONE,
  });

  return { weekStart, layout, diff, blocks: layoutToBlocks(layout, weekStart) };
}

/** Turn a computed layout into the rows we would store. */
export function layoutToBlocks(layout: Layout, weekStart: string): PendingBlock[] {
  const blocks: PendingBlock[] = layout.placements.map((placement) => ({
    taskId: placement.taskId,
    startTime: minutesToInstant(
      placement.date,
      placement.start,
      CALENDAR_TIME_ZONE,
    ).toISOString(),
    endTime: minutesToInstant(
      placement.date,
      placement.end,
      CALENDAR_TIME_ZONE,
    ).toISOString(),
    isResetGap: false,
    isDelegation: false,
    gcalEventId: null,
    weekOf: weekStart,
  }));

  for (const reset of layout.resets) {
    blocks.push({
      taskId: null,
      startTime: minutesToInstant(reset.date, reset.start, CALENDAR_TIME_ZONE).toISOString(),
      endTime: minutesToInstant(reset.date, reset.end, CALENDAR_TIME_ZONE).toISOString(),
      isResetGap: true,
      isDelegation: false,
      gcalEventId: null,
      weekOf: weekStart,
    });
  }

  return blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Compute the week and park the result. Nothing reaches Google Calendar until
 * the diff on screen 1g is approved.
 */
export async function proposeWeek(
  weekStart: string,
  now = new Date(),
): Promise<PendingSchedule> {
  const { diff, blocks } = await computeWeek(weekStart, now);
  return repository().savePendingSchedule({ weekOf: weekStart, diff, blocks });
}

/**
 * Approve a parked proposal: write the blocks to Google Calendar, store them,
 * and move the placed tasks out of the backlog.
 */
export async function approveWeek(weekStart: string): Promise<{
  written: number;
  cleared: number;
}> {
  const repo = repository();
  const pending = await repo.getPendingSchedule(weekStart);
  if (!pending) throw new Error("There is nothing waiting to be approved for this week.");

  const tasks = await repo.listTasks();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const prefix = eventPrefix();

  // Reset gaps are the app's own bookkeeping. They are not written to the
  // calendar — a wall of empty "reset" events would make the week unreadable.
  const writes = pending.blocks
    .filter((block) => !block.isResetGap && block.taskId)
    .map((block) => {
      const task = byId.get(block.taskId!);
      return {
        summary: `${prefix}${task?.title ?? "Task"}`,
        description: task ? describe(task) : undefined,
        start: new Date(block.startTime),
        end: new Date(block.endTime),
      };
    });

  const result = await calendar().writeWeek(weekStart, CALENDAR_TIME_ZONE, writes);

  // Pair each written event id back onto its block, in the order written.
  let idIndex = 0;
  const stored = pending.blocks.map((block) => {
    if (block.isResetGap || !block.taskId) return block;
    return { ...block, gcalEventId: result.ids[idIndex++] ?? null };
  });

  await repo.replaceBlocks(weekStart, stored);

  const placedIds = new Set(
    pending.blocks.filter((b) => b.taskId).map((b) => b.taskId as string),
  );

  await Promise.all(
    tasks
      .filter((task) => task.status !== "done")
      .map((task) => {
        const shouldBe = placedIds.has(task.id) ? "scheduled" : "backlog";
        if (task.status === shouldBe) return Promise.resolve(task);
        return repo.updateTask(task.id, { status: shouldBe });
      }),
  );

  await repo.resolvePendingSchedule(pending.id, "approved");

  return { written: result.created, cleared: result.deleted };
}

export async function discardWeek(weekStart: string): Promise<void> {
  const repo = repository();
  const pending = await repo.getPendingSchedule(weekStart);
  if (pending) await repo.resolvePendingSchedule(pending.id, "discarded");
}

function describe(task: Task): string {
  const meta = categoryMeta(task.category);
  const parts = [
    meta.label,
    task.location === "gym" ? "GYM" : "HOME",
    `${task.estimatedBlocks} BLOCK${task.estimatedBlocks === 1 ? "" : "S"}`,
    `IMPACT ${task.financialImpact}`,
  ];
  return [parts.join(" · "), task.notes].filter(Boolean).join("\n\n");
}

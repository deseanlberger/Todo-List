"use server";

import { revalidatePath } from "next/cache";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { claudeIsConfigured, parseCapture } from "@/lib/capture/parse";
import { repository } from "@/lib/data";
import { categoryMeta, defaultBlocks } from "@/lib/domain/categories";
import { nextOccurrence } from "@/lib/domain/recurrence";
import { isoDate, minutesOfDay, minutesToInstant } from "@/lib/domain/time";
import type { Task, TaskCategory, TaskLocation } from "@/lib/domain/types";
import type { TaskPatch } from "@/lib/data";

/** There is one list now, so there is one path to revalidate. */
function refresh(...paths: string[]) {
  for (const path of ["/", ...paths]) {
    revalidatePath(path);
  }
}

/* ------------------------------------------------------------------ tasks */

export async function setImportance(taskId: string, value: number) {
  const clamped = Math.min(5, Math.max(1, Math.round(value)));
  await repository().updateTask(taskId, { financialImpact: clamped });
  refresh(`/tasks/${taskId}`);
}

export async function patchTask(taskId: string, patch: TaskPatch) {
  await repository().updateTask(taskId, patch);
  refresh(`/tasks/${taskId}`);
}

export async function createTask(input: {
  title: string;
  category: TaskCategory;
  location: TaskLocation;
  estimatedBlocks: number;
  financialImpact: number;
  dueDate: string | null;
  assignee: string | null;
  notes: string | null;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
}) {
  const meta = categoryMeta(input.category);
  const task = await repository().createTask({
    title: input.title.trim(),
    notes: input.notes,
    category: input.category,
    location: input.location,
    // The schema forbids a delegate task claiming more than one block.
    estimatedBlocks: meta.schedules ? input.estimatedBlocks : 1,
    actualBlocks: null,
    dueDate: input.dueDate,
    financialImpact: input.financialImpact,
    assignee: input.category === "delegate" ? input.assignee : null,
    handedOffAt: null,
    status: "backlog",
    isRecurring: input.isRecurring ?? false,
    recurrenceRule: input.isRecurring ? (input.recurrenceRule ?? null) : null,
    reminderLeadDays: 1,
    captureSource: "manual",
    captureTranscript: null,
    completedAt: null,
  });
  refresh();
  return task.id;
}

export async function deleteTask(taskId: string) {
  await repository().deleteTask(taskId);
  refresh();
}

/* ---------------------------------------------------------------- capture */

export interface CapturedSummary {
  id: string;
  title: string;
  category: TaskCategory;
  location: TaskLocation;
  estimatedBlocks: number;
  financialImpact: number;
  dueDate: string | null;
  assignee: string | null;
}

/**
 * Quick add: one spoken or typed message becomes one or more tasks.
 *
 * Same path the Telegram bot uses, so a task captured by voice in the app is
 * indistinguishable from one captured on the phone. Claude parses it when
 * credentials are configured; otherwise the keyword parser still gets it into
 * the backlog rather than dropping what was said.
 */
export async function captureTasks(
  text: string,
  source: "voice" | "text" = "text",
): Promise<CapturedSummary[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const repo = repository();
  const history = await repo.listEstimationHistory(50);
  const parsed = await parseCapture({ text: trimmed, history, now: new Date() });

  const created: CapturedSummary[] = [];
  for (const task of parsed) {
    const saved = await repo.createTask({
      title: task.title,
      notes: null,
      category: task.category,
      location: task.location,
      estimatedBlocks: task.estimatedBlocks,
      actualBlocks: null,
      dueDate: task.dueDate,
      financialImpact: task.financialImpact,
      assignee: task.assignee,
      handedOffAt: null,
      status: "backlog",
      isRecurring: false,
      recurrenceRule: null,
      reminderLeadDays: 1,
      captureSource: source === "voice" ? "telegram_voice" : "manual",
      // Kept so he can check what was actually heard.
      captureTranscript: source === "voice" ? trimmed : null,
      completedAt: null,
    });

    created.push({
      id: saved.id,
      title: saved.title,
      category: saved.category,
      location: saved.location,
      estimatedBlocks: saved.estimatedBlocks,
      financialImpact: saved.financialImpact,
      dueDate: saved.dueDate,
      assignee: saved.assignee,
    });
  }

  refresh();
  return created;
}

/** Whether Claude is doing the parsing, so the UI can be honest about it. */
export async function captureIsSmart(): Promise<boolean> {
  return claudeIsConfigured();
}

/* --------------------------------------------------------------- delegate */

export async function setHandedOff(taskId: string, handedOff: boolean) {
  await repository().updateTask(taskId, {
    handedOffAt: handedOff ? new Date().toISOString() : null,
    status: handedOff ? "done" : "backlog",
    completedAt: handedOff ? new Date().toISOString() : null,
  });
  refresh();
}

export async function assignTask(taskId: string, assignee: string) {
  await repository().updateTask(taskId, { assignee });
  refresh();
}

/* -------------------------------------------------------------- close-out */


/**
 * When a repeating task is finished, put the next one in the backlog.
 *
 * Called from both completion paths — the tick and the close-out — so a
 * recurring task rolls forward however it was finished.
 *
 * The next date is measured from the task's own due date, not from today.
 * Paying rent three days late must not walk the 1st of the month forward to
 * the 4th; the schedule is the schedule.
 */
async function rollForward(task: Task): Promise<void> {
  if (!task.isRecurring || !task.recurrenceRule || !task.dueDate) return;

  const from = isoDate(new Date(task.dueDate), CALENDAR_TIME_ZONE);
  const next = nextOccurrence(task.recurrenceRule, from);
  if (!next) return;

  // Keep the original time of day: rent due at 09:00 stays due at 09:00.
  const minutes = minutesOfDay(new Date(task.dueDate), CALENDAR_TIME_ZONE);

  await repository().createTask({
    title: task.title,
    notes: task.notes,
    category: task.category,
    location: task.location,
    estimatedBlocks: task.estimatedBlocks,
    actualBlocks: null,
    dueDate: minutesToInstant(next, minutes, CALENDAR_TIME_ZONE).toISOString(),
    financialImpact: task.financialImpact,
    assignee: task.assignee,
    handedOffAt: null,
    status: "backlog",
    isRecurring: true,
    recurrenceRule: task.recurrenceRule,
    reminderLeadDays: task.reminderLeadDays,
    captureSource: task.captureSource,
    captureTranscript: null,
    completedAt: null,
  });
}

/**
 * Tick a task off, or put it back.
 *
 * Close-out (§13) is how a *scheduled block* ends, and it records actual
 * versus estimated blocks for the estimator. This is the other case: a task
 * you did without a block against it, or one that turned out not to need
 * doing. There is nothing honest to feed the estimator from a tick — no
 * block ran — so it does not write estimation history. Un-ticking returns
 * the task to the backlog, which is where an unscheduled task belongs; the
 * next Schedule my week places it again.
 */
export async function setTaskDone(taskId: string, done: boolean) {
  const repo = repository();
  const task = await repo.getTask(taskId);

  await repo.updateTask(taskId, {
    status: done ? "done" : "backlog",
    completedAt: done ? new Date().toISOString() : null,
  });

  if (done && task) await rollForward(task);
  refresh();
}

/* --------------------------------------------------- placing by hand (§11) */




/**
 * Sort an imported reminder into a real category.
 *
 * Nothing was guessed on the way in, so this is the first time the task has
 * a category it can be scheduled on. Block size follows from the category,
 * so the estimate is reset to that category's cold-start default (§16)
 * unless the caller says otherwise.
 */
export async function categoriseTask(
  taskId: string,
  category: TaskCategory,
  estimatedBlocks?: number,
) {
  const meta = categoryMeta(category);
  await repository().updateTask(taskId, {
    category,
    needsCategory: false,
    estimatedBlocks: meta.schedules ? (estimatedBlocks ?? defaultBlocks(category)) : 1,
  });
  refresh();
}

/* ------------------------------------------------------------- scheduling */




/* ---------------------------------------------------------- week template */


/* ------------------------------------------------------------ commitments */


export type { Task };

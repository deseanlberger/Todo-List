"use server";

import { revalidatePath } from "next/cache";
import { repository, type NewWindow, type TaskPatch } from "@/lib/data";
import { claudeIsConfigured, parseCapture } from "@/lib/capture/parse";
import { categoryMeta } from "@/lib/domain/categories";
import type { SortMode, Task, TaskCategory, TaskLocation } from "@/lib/domain/types";
import {
  approveWeek,
  discardWeek,
  proposeWeek,
  resolveTargetWeek,
} from "@/lib/schedule-run";

function refresh(...paths: string[]) {
  for (const path of ["/today", "/week", "/tasks", "/delegate", ...paths]) {
    revalidatePath(path);
  }
}

/* ------------------------------------------------------------------ theme */

export async function saveTheme(theme: "dark" | "light") {
  await repository().updateSettings({ theme });
}

export async function saveSortMode(sortMode: SortMode) {
  // Persisted deliberately: the sort is a habit, not a session choice.
  await repository().updateSettings({ defaultSort: sortMode });
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
    isRecurring: false,
    recurrenceRule: null,
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

/** §13. Three outcomes, no partial credit. */
export async function closeOutBlock(input: {
  taskId: string;
  outcome: "completed" | "unfinished" | "swap";
  /** Blocks of extra time, 1-4, for the unfinished case. */
  moreBlocks?: number;
  /** The task taking over the block, for the swap case. */
  swapTaskId?: string;
}) {
  const repo = repository();
  const task = await repo.getTask(input.taskId);
  if (!task) throw new Error(`No task ${input.taskId}`);

  if (input.outcome === "completed") {
    const actual = task.actualBlocks ?? task.estimatedBlocks;
    await repo.updateTask(task.id, {
      status: "done",
      completedAt: new Date().toISOString(),
      actualBlocks: actual,
    });
    // Feeds the estimator prompt (§16).
    await repo.recordEstimation({
      taskId: task.id,
      title: task.title,
      category: task.category,
      estimatedBlocks: task.estimatedBlocks,
      actualBlocks: actual,
      completedAt: new Date().toISOString(),
    });
  }

  if (input.outcome === "unfinished") {
    const more = Math.min(4, Math.max(1, input.moreBlocks ?? 1));
    // Back to the backlog at the *reduced* estimate: what is left, not what
    // it originally cost.
    await repo.updateTask(task.id, { status: "backlog", estimatedBlocks: more });
  }

  if (input.outcome === "swap") {
    if (!input.swapTaskId) throw new Error("A swap needs a task to swap in.");
    // The displaced task returns to the backlog untouched.
    await repo.updateTask(task.id, { status: "backlog" });
    await repo.updateTask(input.swapTaskId, { status: "scheduled" });
  }

  refresh();
}

/* ------------------------------------------------------------- scheduling */

export async function scheduleMyWeek(weekStart?: string) {
  const week = weekStart ?? (await resolveTargetWeek());
  const pending = await proposeWeek(week);
  refresh("/review");
  return { weekStart: week, changes: pending.diff.totalChanges };
}

export async function approveSchedule(weekStart: string) {
  const result = await approveWeek(weekStart);
  refresh("/review");
  return result;
}

export async function discardSchedule(weekStart: string) {
  await discardWeek(weekStart);
  refresh("/review");
}

/* ---------------------------------------------------------- week template */

export async function saveWeekTemplate(input: {
  windows: NewWindow[];
  deepFocusCap: number;
  resetMinutes: 10 | 15;
  weekendUncapped: boolean;
}) {
  const repo = repository();
  await repo.replaceWindows(input.windows);
  await repo.updateSettings({
    deepFocusCap: input.deepFocusCap,
    resetMinutes: input.resetMinutes,
    weekendUncapped: input.weekendUncapped,
  });
  // §3: template edits apply on the next run. Placed blocks are not touched.
  refresh("/settings/week-template");
}

export type { Task };

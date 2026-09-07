import type {
  AvailabilityOverride,
  AvailabilityWindow,
  EstimationSample,
  SchedulerSettings,
  ScheduledBlock,
  Task,
} from "@/lib/domain/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function toTask(row: any): Task {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    notes: row.notes ?? null,
    category: row.category,
    location: row.location,
    estimatedBlocks: row.estimated_blocks,
    actualBlocks: row.actual_blocks ?? null,
    dueDate: row.due_date ?? null,
    financialImpact: row.financial_impact,
    assignee: row.assignee ?? null,
    handedOffAt: row.handed_off_at ?? null,
    status: row.status,
    isRecurring: row.is_recurring,
    recurrenceRule: row.recurrence_rule ?? null,
    reminderLeadDays: row.reminder_lead_days,
    captureSource: row.capture_source ?? null,
    captureTranscript: row.capture_transcript ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

export function fromTask(task: Partial<Task>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  put("id", task.id);
  put("user_id", task.userId);
  put("title", task.title);
  put("notes", task.notes);
  put("category", task.category);
  put("location", task.location);
  put("estimated_blocks", task.estimatedBlocks);
  put("actual_blocks", task.actualBlocks);
  put("due_date", task.dueDate);
  put("financial_impact", task.financialImpact);
  put("assignee", task.assignee);
  put("handed_off_at", task.handedOffAt);
  put("status", task.status);
  put("is_recurring", task.isRecurring);
  put("recurrence_rule", task.recurrenceRule);
  put("reminder_lead_days", task.reminderLeadDays);
  put("capture_source", task.captureSource);
  put("capture_transcript", task.captureTranscript);
  put("completed_at", task.completedAt);
  return row;
}

export function toWindow(row: any): AvailabilityWindow {
  return {
    id: row.id,
    userId: row.user_id,
    weekday: row.weekday,
    // Postgres `time` comes back as HH:MM:SS.
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    allowance: row.allowance,
    sortOrder: row.sort_order,
  };
}

export function toOverride(row: any): AvailabilityOverride {
  return {
    id: row.id,
    userId: row.user_id,
    onDate: row.on_date,
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
    allowance: row.allowance,
    reason: row.reason ?? null,
  };
}

export function toBlock(row: any): ScheduledBlock {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id ?? null,
    startTime: row.start_time,
    endTime: row.end_time,
    isResetGap: row.is_reset_gap,
    isDelegation: row.is_delegation,
    gcalEventId: row.gcal_event_id ?? null,
    weekOf: row.week_of,
    createdAt: row.created_at,
  };
}

export function fromBlock(block: Partial<ScheduledBlock>): Record<string, unknown> {
  return {
    user_id: block.userId,
    task_id: block.taskId ?? null,
    start_time: block.startTime,
    end_time: block.endTime,
    is_reset_gap: block.isResetGap ?? false,
    is_delegation: block.isDelegation ?? false,
    gcal_event_id: block.gcalEventId ?? null,
    week_of: block.weekOf,
  };
}

export function toSettings(row: any): SchedulerSettings {
  return {
    userId: row.user_id,
    deepFocusCap: row.deep_focus_cap,
    weekendUncapped: row.weekend_uncapped,
    resetMinutes: row.reset_minutes,
    deepFocusMinutes: row.deep_focus_minutes,
    standardMinutes: row.standard_minutes,
    gcalEventPrefix: row.gcal_event_prefix,
    theme: row.theme,
    defaultSort: row.default_sort,
  };
}

export function fromSettings(settings: Partial<SchedulerSettings>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  put("deep_focus_cap", settings.deepFocusCap);
  put("weekend_uncapped", settings.weekendUncapped);
  put("reset_minutes", settings.resetMinutes);
  put("deep_focus_minutes", settings.deepFocusMinutes);
  put("standard_minutes", settings.standardMinutes);
  put("gcal_event_prefix", settings.gcalEventPrefix);
  put("theme", settings.theme);
  put("default_sort", settings.defaultSort);
  return row;
}

export function toEstimation(row: any): EstimationSample {
  return {
    title: row.title,
    category: row.category,
    estimatedBlocks: row.estimated_blocks,
    actualBlocks: row.actual_blocks,
    completedAt: row.completed_at,
  };
}

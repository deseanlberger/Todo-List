import type {
  AvailabilityOverride,
  AvailabilityWindow,
  CalendarEvent,
  SchedulerSettings,
  ScheduledBlock,
  Task,
  TaskCategory,
} from "@/lib/domain/types";
import { minutesToInstant } from "./index";

export const TEST_USER = "00000000-0000-0000-0000-000000000000";
export const TEST_TZ = "America/Los_Angeles";
/** A Monday. */
export const WEEK_START = "2026-09-07";
/** The Sunday before, so the whole week is in the future. */
export const NOW = new Date("2026-09-06T19:00:00Z");

let seq = 0;

export function makeTask(overrides: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `task-${String(seq).padStart(3, "0")}`,
    userId: TEST_USER,
    title: `Task ${seq}`,
    notes: null,
    category: "high_priority_admin",
    location: "home",
    estimatedBlocks: 1,
    actualBlocks: null,
    dueDate: null,
    financialImpact: 3,
    assignee: null,
    handedOffAt: null,
    status: "backlog",
    isRecurring: false,
    recurrenceRule: null,
    reminderLeadDays: 1,
    captureSource: "manual",
    captureTranscript: null,
    createdAt: "2026-09-01T00:00:00Z",
    completedAt: null,
    ...overrides,
  };
}

export function makeWindow(
  weekday: number,
  startTime: string,
  endTime: string,
  allowance: AvailabilityWindow["allowance"] = "any",
  label: string | null = null,
): AvailabilityWindow {
  seq += 1;
  return {
    id: `window-${seq}`,
    userId: TEST_USER,
    weekday,
    startTime,
    endTime,
    allowance,
    label,
    sortOrder: 0,
  };
}

export function makeOverride(
  onDate: string,
  overrides: Partial<AvailabilityOverride> = {},
): AvailabilityOverride {
  seq += 1;
  return {
    id: `override-${seq}`,
    userId: TEST_USER,
    onDate,
    startTime: null,
    endTime: null,
    allowance: "no_work",
    reason: null,
    ...overrides,
  };
}

/** A wall on `date`, given as local `HH:MM` strings. */
export function makeEvent(
  date: string,
  start: string,
  end: string,
  summary = "Blocked",
  options: Partial<CalendarEvent> = {},
): CalendarEvent {
  seq += 1;
  const toIso = (clock: string) => {
    const [h, m] = clock.split(":").map(Number);
    return minutesToInstant(date, h * 60 + m, TEST_TZ).toISOString();
  };
  return {
    id: `event-${seq}`,
    summary,
    start: toIso(start),
    end: toIso(end),
    location: null,
    isOurs: false,
    ...options,
  };
}

export function makeBlock(
  taskId: string,
  date: string,
  start: string,
  end: string,
  overrides: Partial<ScheduledBlock> = {},
): ScheduledBlock {
  seq += 1;
  const toIso = (clock: string) => {
    const [h, m] = clock.split(":").map(Number);
    return minutesToInstant(date, h * 60 + m, TEST_TZ).toISOString();
  };
  return {
    id: `block-${seq}`,
    userId: TEST_USER,
    taskId,
    startTime: toIso(start),
    endTime: toIso(end),
    isResetGap: false,
    isDelegation: false,
    gcalEventId: `gcal-${seq}`,
    weekOf: WEEK_START,
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

export function makeSettings(overrides: Partial<SchedulerSettings> = {}): SchedulerSettings {
  return {
    userId: TEST_USER,
    deepFocusCap: 3,
    weekendUncapped: true,
    resetMinutes: 15,
    deepFocusMinutes: 45,
    standardMinutes: 30,
    gcalEventPrefix: "[ODY] ",
    theme: "dark",
    defaultSort: "category",
    ...overrides,
  };
}

export function deepFocus(overrides: Partial<Task> = {}): Task {
  return makeTask({ category: "deep_focus" as TaskCategory, ...overrides });
}

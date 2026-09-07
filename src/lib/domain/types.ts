/**
 * Core domain types. These mirror `supabase/migrations/0001_init.sql` one for
 * one; if you change a column there, change it here.
 */

export type TaskCategory =
  | "deep_focus"
  | "high_priority_admin"
  | "low_priority_admin"
  | "personal"
  | "delegate";

export type TaskLocation = "gym" | "home";

export type TaskStatus = "backlog" | "scheduled" | "done";

export type WindowAllowance = "any" | "deep_focus" | "admin_only" | "no_work";

export type CaptureSource = "telegram_voice" | "telegram_text" | "manual";

export interface Task {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  category: TaskCategory;
  location: TaskLocation;
  /** 1 block = 45 min for deep_focus, 30 min for everything else. */
  estimatedBlocks: number;
  actualBlocks: number | null;
  /** ISO 8601. Null means no deadline. */
  dueDate: string | null;
  /** The 1-5 star rating on All Tasks. One field, one editor. */
  financialImpact: number;
  assignee: string | null;
  handedOffAt: string | null;
  status: TaskStatus;
  isRecurring: boolean;
  recurrenceRule: string | null;
  reminderLeadDays: number;
  captureSource: CaptureSource | null;
  captureTranscript: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ScheduledBlock {
  id: string;
  userId: string;
  /** Null when `isResetGap` is true — a reset belongs to no task. */
  taskId: string | null;
  startTime: string;
  endTime: string;
  isResetGap: boolean;
  isDelegation: boolean;
  gcalEventId: string | null;
  /** Monday of the target week, as `YYYY-MM-DD`. */
  weekOf: string;
  createdAt: string;
}

export interface AvailabilityWindow {
  id: string;
  userId: string;
  /** 0 = Monday ... 6 = Sunday. */
  weekday: number;
  /** `HH:MM` local. */
  startTime: string;
  endTime: string;
  allowance: WindowAllowance;
  /**
   * What this window is, in the user's words. Optional. A closed window
   * carries its reason here, and shows on the calendar when it has one.
   */
  label: string | null;
  sortOrder: number;
}

export interface AvailabilityOverride {
  id: string;
  userId: string;
  /** `YYYY-MM-DD`. */
  onDate: string;
  /** Both null = the whole day is closed. */
  startTime: string | null;
  endTime: string | null;
  allowance: WindowAllowance;
  reason: string | null;
}

/**
 * A fixed, same-time-every-week commitment: coaching a group, a standing
 * meeting, a lift. A wall to the scheduler, never a task.
 */
export interface Commitment {
  id: string;
  userId: string;
  title: string;
  /** 0 = Monday ... 6 = Sunday. */
  weekday: number;
  /** `HH:MM` local. */
  startTime: string;
  endTime: string;
  location: TaskLocation;
  sortOrder: number;
}

export interface SchedulerSettings {
  userId: string;
  deepFocusCap: number;
  weekendUncapped: boolean;
  resetMinutes: 10 | 15;
  deepFocusMinutes: number;
  standardMinutes: number;
  gcalEventPrefix: string;
  theme: "dark" | "light";
  defaultSort: SortMode;
}

export type SortMode = "category" | "due" | "stars";

/** An existing Google Calendar event. To the scheduler, an immovable wall. */
export interface CalendarEvent {
  id: string;
  summary: string;
  /** ISO 8601. */
  start: string;
  end: string;
  location: string | null;
  /** True when this event was written by this app on a previous run. */
  isOurs: boolean;
  /**
   * Set only when we know for certain — a commitment the user tagged. Left
   * undefined for a Google event, where the keyword heuristic has to guess.
   */
  atGym?: boolean;
}

export interface EstimationSample {
  title: string;
  category: TaskCategory;
  estimatedBlocks: number;
  actualBlocks: number;
  completedAt: string;
}

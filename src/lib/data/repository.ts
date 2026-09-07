import type {
  AvailabilityOverride,
  AvailabilityWindow,
  EstimationSample,
  SchedulerSettings,
  ScheduledBlock,
  Task,
} from "@/lib/domain/types";
import type { ScheduleDiff } from "@/lib/scheduler";

export type NewTask = Omit<Task, "id" | "userId" | "createdAt"> & {
  id?: string;
};

export type TaskPatch = Partial<Omit<Task, "id" | "userId" | "createdAt">>;

export type NewWindow = Omit<AvailabilityWindow, "id" | "userId"> & {
  id?: string;
};

export interface PendingSchedule {
  id: string;
  weekOf: string;
  diff: ScheduleDiff;
  /** Everything needed to write the week, held until the diff is approved. */
  blocks: Omit<ScheduledBlock, "id" | "userId" | "createdAt">[];
  createdAt: string;
}

/**
 * Everything the app needs from storage. Two implementations: Supabase when
 * it is configured, and an in-memory demo store otherwise so the app runs
 * with no setup at all.
 */
export interface Repository {
  readonly kind: "supabase" | "demo";

  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  createTask(task: NewTask): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  listWindows(): Promise<AvailabilityWindow[]>;
  replaceWindows(windows: NewWindow[]): Promise<AvailabilityWindow[]>;

  listOverrides(fromDate: string, toDate: string): Promise<AvailabilityOverride[]>;

  getSettings(): Promise<SchedulerSettings>;
  updateSettings(patch: Partial<SchedulerSettings>): Promise<SchedulerSettings>;

  listBlocks(weekOf: string): Promise<ScheduledBlock[]>;
  /** Blocks starting inside `[fromIso, toIso)`. Used by the month view. */
  listBlocksBetween(fromIso: string, toIso: string): Promise<ScheduledBlock[]>;
  replaceBlocks(
    weekOf: string,
    blocks: Omit<ScheduledBlock, "id" | "userId" | "createdAt">[],
  ): Promise<ScheduledBlock[]>;

  savePendingSchedule(
    pending: Omit<PendingSchedule, "id" | "createdAt">,
  ): Promise<PendingSchedule>;
  getPendingSchedule(weekOf: string): Promise<PendingSchedule | null>;
  resolvePendingSchedule(id: string, outcome: "approved" | "discarded"): Promise<void>;

  recordEstimation(sample: EstimationSample & { taskId: string }): Promise<void>;
  listEstimationHistory(limit: number): Promise<EstimationSample[]>;
}

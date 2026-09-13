import type {
  AvailabilityOverride,
  AvailabilityWindow,
  Commitment,
  EstimationSample,
  SchedulerSettings,
  ScheduledBlock,
  Task,
} from "@/lib/domain/types";
import type { ScheduleDiff } from "@/lib/scheduler";

/**
 * Both inbox fields are optional: almost every task is created already
 * categorised, and only the inbox route sets them.
 */
export type NewTask = Omit<
  Task,
  "id" | "userId" | "createdAt" | "needsCategory" | "externalId"
> & {
  id?: string;
  needsCategory?: boolean;
  externalId?: string | null;
};

export type TaskPatch = Partial<Omit<Task, "id" | "userId" | "createdAt">>;

export type NewWindow = Omit<AvailabilityWindow, "id" | "userId"> & {
  id?: string;
};

export type NewCommitment = Omit<Commitment, "id" | "userId"> & {
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

  listCommitments(): Promise<Commitment[]>;
  replaceCommitments(commitments: NewCommitment[]): Promise<Commitment[]>;

  getSettings(): Promise<SchedulerSettings>;
  updateSettings(patch: Partial<SchedulerSettings>): Promise<SchedulerSettings>;

  listBlocks(weekOf: string): Promise<ScheduledBlock[]>;
  /** Blocks starting inside `[fromIso, toIso)`. Used by the month view. */
  listBlocksBetween(fromIso: string, toIso: string): Promise<ScheduledBlock[]>;
  replaceBlocks(
    weekOf: string,
    blocks: Omit<ScheduledBlock, "id" | "userId" | "createdAt">[],
  ): Promise<ScheduledBlock[]>;

  /**
   * Add one block without touching the rest of the week. `replaceBlocks` is
   * for the scheduler writing a whole layout; this is for the user placing a
   * single task by hand, which must not disturb anything already there.
   */
  addBlock(
    block: Omit<ScheduledBlock, "id" | "userId" | "createdAt">,
  ): Promise<ScheduledBlock>;

  /** Every block belonging to a task, wherever it sits. */
  deleteBlocksForTask(taskId: string): Promise<void>;

  savePendingSchedule(
    pending: Omit<PendingSchedule, "id" | "createdAt">,
  ): Promise<PendingSchedule>;
  getPendingSchedule(weekOf: string): Promise<PendingSchedule | null>;
  resolvePendingSchedule(id: string, outcome: "approved" | "discarded"): Promise<void>;

  recordEstimation(sample: EstimationSample & { taskId: string }): Promise<void>;
  listEstimationHistory(limit: number): Promise<EstimationSample[]>;
}

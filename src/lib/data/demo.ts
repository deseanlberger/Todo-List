import { randomUUID } from "node:crypto";
import type {
  AvailabilityOverride,
  AvailabilityWindow,
  EstimationSample,
  SchedulerSettings,
  ScheduledBlock,
  Task,
} from "@/lib/domain/types";
import type {
  NewTask,
  NewWindow,
  PendingSchedule,
  Repository,
  TaskPatch,
} from "./repository";
import { DEMO_USER_ID, SEED_SETTINGS, SEED_WINDOWS, seedTasks } from "./seed";

interface DemoState {
  tasks: Task[];
  windows: AvailabilityWindow[];
  overrides: AvailabilityOverride[];
  settings: SchedulerSettings;
  blocks: ScheduledBlock[];
  pending: (PendingSchedule & { resolvedAt: string | null })[];
  estimations: (EstimationSample & { taskId: string })[];
}

/**
 * The demo store lives on `globalThis` so it survives Next's dev-time module
 * reloading. Without that, every hot reload would silently reset the week.
 */
const STORE_KEY = Symbol.for("odyssey.demoStore");

function state(): DemoState {
  const globalRef = globalThis as unknown as Record<symbol, DemoState | undefined>;
  if (!globalRef[STORE_KEY]) {
    const now = new Date();
    globalRef[STORE_KEY] = {
      tasks: seedTasks(now),
      windows: SEED_WINDOWS.map((w) => ({
        ...w,
        id: randomUUID(),
        userId: DEMO_USER_ID,
      })),
      overrides: [],
      settings: { ...SEED_SETTINGS },
      blocks: [],
      pending: [],
      estimations: [],
    };
  }
  return globalRef[STORE_KEY]!;
}

/** Test seam: drop the store so a fresh one is seeded on next access. */
export function resetDemoStore(): void {
  const globalRef = globalThis as unknown as Record<symbol, DemoState | undefined>;
  globalRef[STORE_KEY] = undefined;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class DemoRepository implements Repository {
  readonly kind = "demo" as const;

  async listTasks(): Promise<Task[]> {
    return clone(state().tasks);
  }

  async getTask(id: string): Promise<Task | null> {
    return clone(state().tasks.find((t) => t.id === id) ?? null);
  }

  async createTask(task: NewTask): Promise<Task> {
    const created: Task = {
      ...task,
      id: task.id ?? randomUUID(),
      userId: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
    };
    state().tasks.unshift(created);
    return clone(created);
  }

  async updateTask(id: string, patch: TaskPatch): Promise<Task> {
    const store = state();
    const index = store.tasks.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`No task ${id}`);
    store.tasks[index] = { ...store.tasks[index], ...patch };
    return clone(store.tasks[index]);
  }

  async deleteTask(id: string): Promise<void> {
    const store = state();
    store.tasks = store.tasks.filter((t) => t.id !== id);
    store.blocks = store.blocks.filter((b) => b.taskId !== id);
  }

  async listWindows(): Promise<AvailabilityWindow[]> {
    return clone(
      [...state().windows].sort(
        (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
      ),
    );
  }

  async replaceWindows(windows: NewWindow[]): Promise<AvailabilityWindow[]> {
    state().windows = windows.map((w) => ({
      ...w,
      id: w.id ?? randomUUID(),
      userId: DEMO_USER_ID,
    }));
    return this.listWindows();
  }

  async listOverrides(fromDate: string, toDate: string): Promise<AvailabilityOverride[]> {
    return clone(
      state().overrides.filter((o) => o.onDate >= fromDate && o.onDate <= toDate),
    );
  }

  async getSettings(): Promise<SchedulerSettings> {
    return clone(state().settings);
  }

  async updateSettings(patch: Partial<SchedulerSettings>): Promise<SchedulerSettings> {
    const store = state();
    store.settings = { ...store.settings, ...patch };
    return clone(store.settings);
  }

  async listBlocks(weekOf: string): Promise<ScheduledBlock[]> {
    return clone(state().blocks.filter((b) => b.weekOf === weekOf));
  }

  async listBlocksBetween(fromIso: string, toIso: string): Promise<ScheduledBlock[]> {
    return clone(
      state().blocks.filter(
        (block) => block.startTime >= fromIso && block.startTime < toIso,
      ),
    );
  }

  async replaceBlocks(
    weekOf: string,
    blocks: Omit<ScheduledBlock, "id" | "userId" | "createdAt">[],
  ): Promise<ScheduledBlock[]> {
    const store = state();
    store.blocks = store.blocks.filter((b) => b.weekOf !== weekOf);
    const created = blocks.map((b) => ({
      ...b,
      id: randomUUID(),
      userId: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
    }));
    store.blocks.push(...created);
    return clone(created);
  }

  async savePendingSchedule(
    pending: Omit<PendingSchedule, "id" | "createdAt">,
  ): Promise<PendingSchedule> {
    const store = state();
    // Only one live proposal per week; a new run supersedes the old one.
    store.pending = store.pending.filter(
      (p) => p.weekOf !== pending.weekOf || p.resolvedAt !== null,
    );
    const created = {
      ...pending,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    store.pending.push(created);
    return clone(stripResolved(created));
  }

  async getPendingSchedule(weekOf: string): Promise<PendingSchedule | null> {
    const found = state().pending.find(
      (p) => p.weekOf === weekOf && p.resolvedAt === null,
    );
    return found ? clone(stripResolved(found)) : null;
  }

  async resolvePendingSchedule(id: string): Promise<void> {
    const found = state().pending.find((p) => p.id === id);
    if (found) found.resolvedAt = new Date().toISOString();
  }

  async recordEstimation(sample: EstimationSample & { taskId: string }): Promise<void> {
    state().estimations.unshift(sample);
  }

  async listEstimationHistory(limit: number): Promise<EstimationSample[]> {
    return clone(state().estimations.slice(0, limit));
  }
}

function stripResolved(
  value: PendingSchedule & { resolvedAt: string | null },
): PendingSchedule {
  const { ...rest } = value;
  return rest;
}

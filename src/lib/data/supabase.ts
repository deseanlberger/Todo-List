import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasEnv } from "@/lib/env";
import type {
  AvailabilityOverride,
  AvailabilityWindow,
  Commitment,
  EstimationSample,
  SchedulerSettings,
  ScheduledBlock,
  Task,
} from "@/lib/domain/types";
import {
  fromBlock,
  fromSettings,
  fromTask,
  toBlock,
  toCommitment,
  toEstimation,
  toOverride,
  toSettings,
  toTask,
  toWindow,
} from "./mappers";
import type {
  NewCommitment,
  NewTask,
  NewWindow,
  PendingSchedule,
  Repository,
  TaskPatch,
} from "./repository";
import { SEED_SETTINGS } from "./seed";

/**
 * NOTE: the Supabase project lives in `us-west-2`. `vercel.json` pins the
 * functions to `pdx1` so they sit beside it. Every read below is a round
 * trip; from the default `iad1` each one crossed the country and back, and
 * a page makes several. Keep the two regions together.
 */
export function supabaseIsConfigured(): boolean {
  return (
    hasEnv("NEXT_PUBLIC_SUPABASE_URL") &&
    (hasEnv("SUPABASE_SERVICE_ROLE_KEY") || hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
  );
}

function client(): SupabaseClient {
  const url = env("NEXT_PUBLIC_SUPABASE_URL", "");
  // The modern `sb_secret_…` key and the legacy service_role JWT are both
  // accepted here; either one bypasses RLS, which the app relies on.
  const key = hasEnv("SUPABASE_SERVICE_ROLE_KEY")
    ? env("SUPABASE_SERVICE_ROLE_KEY", "")
    : env("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Anything that comes back with an error is a bug, not a soft failure. */
function unwrap<T>(result: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) {
    throw new Error("Supabase returned no rows where exactly one was expected");
  }
  return result.data as NonNullable<T>;
}

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;

  private db = client();
  private userId = env("APP_USER_ID", "00000000-0000-0000-0000-000000000000");

  async listTasks(): Promise<Task[]> {
    const rows = unwrap(
      await this.db
        .from("tasks")
        .select("*")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: false }),
    );
    return rows.map(toTask);
  }

  async getTask(id: string): Promise<Task | null> {
    const { data, error } = await this.db
      .from("tasks")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toTask(data) : null;
  }

  async createTask(task: NewTask): Promise<Task> {
    const row = unwrap(
      await this.db
        .from("tasks")
        .insert({ ...fromTask(task as Partial<Task>), user_id: this.userId })
        .select()
        .single(),
    );
    return toTask(row);
  }

  async updateTask(id: string, patch: TaskPatch): Promise<Task> {
    const row = unwrap(
      await this.db
        .from("tasks")
        .update(fromTask(patch as Partial<Task>))
        .eq("user_id", this.userId)
        .eq("id", id)
        .select()
        .single(),
    );
    return toTask(row);
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await this.db
      .from("tasks")
      .delete()
      .eq("user_id", this.userId)
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listWindows(): Promise<AvailabilityWindow[]> {
    const rows = unwrap(
      await this.db
        .from("availability_windows")
        .select("*")
        .eq("user_id", this.userId)
        .order("weekday")
        .order("start_time"),
    );
    return rows.map(toWindow);
  }

  async replaceWindows(windows: NewWindow[]): Promise<AvailabilityWindow[]> {
    // The template is small and edited as a whole on screen 3a, so a
    // replace is both simpler and safer than reconciling row by row.
    const { error } = await this.db
      .from("availability_windows")
      .delete()
      .eq("user_id", this.userId);
    if (error) throw new Error(error.message);

    if (windows.length > 0) {
      const insert = await this.db.from("availability_windows").insert(
        windows.map((w) => ({
          user_id: this.userId,
          weekday: w.weekday,
          start_time: w.startTime,
          end_time: w.endTime,
          allowance: w.allowance,
          sort_order: w.sortOrder,
        })),
      );
      if (insert.error) throw new Error(insert.error.message);
    }

    return this.listWindows();
  }

  async listOverrides(fromDate: string, toDate: string): Promise<AvailabilityOverride[]> {
    const rows = unwrap(
      await this.db
        .from("availability_overrides")
        .select("*")
        .eq("user_id", this.userId)
        .gte("on_date", fromDate)
        .lte("on_date", toDate),
    );
    return rows.map(toOverride);
  }

  async listCommitments(): Promise<Commitment[]> {
    const rows = unwrap(
      await this.db
        .from("commitments")
        .select("*")
        .eq("user_id", this.userId)
        .order("weekday")
        .order("start_time"),
    );
    return rows.map(toCommitment);
  }

  async replaceCommitments(commitments: NewCommitment[]): Promise<Commitment[]> {
    // Same reasoning as replaceWindows: the list is small and edited whole.
    const { error } = await this.db
      .from("commitments")
      .delete()
      .eq("user_id", this.userId);
    if (error) throw new Error(error.message);

    if (commitments.length > 0) {
      const insert = await this.db.from("commitments").insert(
        commitments.map((c) => ({
          user_id: this.userId,
          title: c.title,
          weekday: c.weekday,
          start_time: c.startTime,
          end_time: c.endTime,
          location: c.location,
          sort_order: c.sortOrder,
        })),
      );
      if (insert.error) throw new Error(insert.error.message);
    }

    return this.listCommitments();
  }

  private async selectSettings(): Promise<SchedulerSettings | null> {
    const { data, error } = await this.db
      .from("scheduler_settings")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toSettings(data) : null;
  }

  async getSettings(): Promise<SchedulerSettings> {
    const existing = await this.selectSettings();
    if (existing) return existing;

    // First run: write the defaults rather than making every caller cope with
    // a missing row. Several requests hit this at once on a cold start — a
    // plain insert makes all but the first fail on the primary key, so upsert
    // and let the losers no-op.
    const { error } = await this.db
      .from("scheduler_settings")
      .upsert({ user_id: this.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    const created = await this.selectSettings();
    if (!created) throw new Error("Could not create the scheduler settings row");
    return created;
  }

  async updateSettings(patch: Partial<SchedulerSettings>): Promise<SchedulerSettings> {
    await this.getSettings();
    const row = unwrap(
      await this.db
        .from("scheduler_settings")
        .update({ ...fromSettings(patch), updated_at: new Date().toISOString() })
        .eq("user_id", this.userId)
        .select()
        .single(),
    );
    return toSettings(row);
  }

  async listBlocks(weekOf: string): Promise<ScheduledBlock[]> {
    const rows = unwrap(
      await this.db
        .from("scheduled_blocks")
        .select("*")
        .eq("user_id", this.userId)
        .eq("week_of", weekOf)
        .order("start_time"),
    );
    return rows.map(toBlock);
  }

  async listBlocksBetween(fromIso: string, toIso: string): Promise<ScheduledBlock[]> {
    const rows = unwrap(
      await this.db
        .from("scheduled_blocks")
        .select("*")
        .eq("user_id", this.userId)
        .gte("start_time", fromIso)
        .lt("start_time", toIso)
        .order("start_time"),
    );
    return rows.map(toBlock);
  }

  async replaceBlocks(
    weekOf: string,
    blocks: Omit<ScheduledBlock, "id" | "userId" | "createdAt">[],
  ): Promise<ScheduledBlock[]> {
    const { error } = await this.db
      .from("scheduled_blocks")
      .delete()
      .eq("user_id", this.userId)
      .eq("week_of", weekOf);
    if (error) throw new Error(error.message);

    if (blocks.length === 0) return [];

    const rows = unwrap(
      await this.db
        .from("scheduled_blocks")
        .insert(blocks.map((b) => fromBlock({ ...b, userId: this.userId })))
        .select(),
    );
    return rows.map(toBlock);
  }

  async savePendingSchedule(
    pending: Omit<PendingSchedule, "id" | "createdAt">,
  ): Promise<PendingSchedule> {
    // Supersede any live proposal for the same week.
    await this.db
      .from("pending_schedules")
      .update({ discarded_at: new Date().toISOString() })
      .eq("user_id", this.userId)
      .eq("week_of", pending.weekOf)
      .is("approved_at", null)
      .is("discarded_at", null);

    const row = unwrap(
      await this.db
        .from("pending_schedules")
        .insert({
          user_id: this.userId,
          week_of: pending.weekOf,
          payload: { diff: pending.diff, blocks: pending.blocks },
        })
        .select()
        .single(),
    );

    return {
      id: row.id,
      weekOf: row.week_of,
      diff: row.payload.diff,
      blocks: row.payload.blocks,
      createdAt: row.created_at,
    };
  }

  async getPendingSchedule(weekOf: string): Promise<PendingSchedule | null> {
    const { data, error } = await this.db
      .from("pending_schedules")
      .select("*")
      .eq("user_id", this.userId)
      .eq("week_of", weekOf)
      .is("approved_at", null)
      .is("discarded_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      weekOf: data.week_of,
      diff: data.payload.diff,
      blocks: data.payload.blocks,
      createdAt: data.created_at,
    };
  }

  async resolvePendingSchedule(
    id: string,
    outcome: "approved" | "discarded",
  ): Promise<void> {
    const column = outcome === "approved" ? "approved_at" : "discarded_at";
    const { error } = await this.db
      .from("pending_schedules")
      .update({ [column]: new Date().toISOString() })
      .eq("user_id", this.userId)
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async recordEstimation(sample: EstimationSample & { taskId: string }): Promise<void> {
    const { error } = await this.db.from("estimation_history").insert({
      user_id: this.userId,
      task_id: sample.taskId,
      title: sample.title,
      category: sample.category,
      estimated_blocks: sample.estimatedBlocks,
      actual_blocks: sample.actualBlocks,
    });
    if (error) throw new Error(error.message);
  }

  async listEstimationHistory(limit: number): Promise<EstimationSample[]> {
    const rows = unwrap(
      await this.db
        .from("estimation_history")
        .select("*")
        .eq("user_id", this.userId)
        .order("completed_at", { ascending: false })
        .limit(limit),
    );
    return rows.map(toEstimation);
  }
}

export const DEFAULT_SETTINGS = SEED_SETTINGS;

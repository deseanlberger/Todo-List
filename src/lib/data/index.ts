import "server-only";
import { DemoRepository } from "./demo";
import type { Repository } from "./repository";
import { SupabaseRepository, supabaseIsConfigured } from "./supabase";

export * from "./repository";
export { resetDemoStore } from "./demo";

let cached: Repository | null = null;

/**
 * Supabase when it is configured, the in-memory demo store otherwise.
 *
 * The fallback is deliberate: the app should run and be judged with `npm run
 * dev` and nothing else. Check `repository().kind` before telling the user
 * their data is durable.
 */
export function repository(): Repository {
  if (!cached) {
    cached = supabaseIsConfigured() ? new SupabaseRepository() : new DemoRepository();
  }
  return cached;
}

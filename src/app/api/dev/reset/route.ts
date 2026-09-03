import { NextResponse } from "next/server";
import { repository, resetDemoStore } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Re-seed the in-memory demo store.
 *
 * Only ever touches the demo store: when Supabase is configured this refuses
 * rather than doing anything, so there is no path from here to real data.
 */
export async function POST() {
  if (repository().kind !== "demo") {
    return NextResponse.json(
      { error: "Storage is Supabase; there is no demo store to reset." },
      { status: 409 },
    );
  }

  resetDemoStore();
  return NextResponse.json({ ok: true, reseeded: true });
}

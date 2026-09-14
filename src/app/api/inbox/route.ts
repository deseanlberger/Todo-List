import { NextResponse } from "next/server";
import { repository } from "@/lib/data";
import { hasEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Where reminders from the phone land.
 *
 * Apple Reminders has no cloud API, and no web app can read EventKit, so
 * the server cannot poll the device. The device pushes: an iOS Shortcut
 * automation reads Reminders on a schedule and posts them here.
 *
 * Everything arrives UNCATEGORISED on purpose. Category decides block size,
 * what window a task may sit in, and how it ranks — guessing it from a
 * one-line reminder would be confidently wrong, so the app asks instead.
 *
 * Body: { items: [{ id, title, due? , notes? }] }
 *   id    a stable id from the source. The same reminder posted twice is
 *         ignored the second time, which is what makes a daily re-post of
 *         the whole list safe.
 *   due   ISO 8601, or omitted.
 */
export async function POST(request: Request) {
  if (!hasEnv("INBOX_SECRET")) {
    return NextResponse.json({ error: "Inbox is not configured" }, { status: 503 });
  }

  const offered = request.headers.get("authorization") ?? "";
  if (offered !== `Bearer ${process.env.INBOX_SECRET}`) {
    return NextResponse.json({ error: "Bad secret" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }

  const items = parseItems(body);
  if (items === null) {
    return NextResponse.json(
      { error: "Expected { items: [{ id, title, due? }] }" },
      { status: 400 },
    );
  }

  const repo = repository();
  const existing = new Set(
    (await repo.listTasks()).map((task) => task.externalId).filter(Boolean),
  );

  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    if (existing.has(item.id)) {
      skipped += 1;
      continue;
    }

    await repo.createTask({
      title: item.title,
      notes: item.notes,
      // A placeholder, not a guess. `needsCategory` is what the app reads.
      category: "low_priority_admin",
      location: "home",
      estimatedBlocks: 1,
      actualBlocks: null,
      dueDate: item.due,
      financialImpact: 3,
      assignee: null,
      handedOffAt: null,
      status: "backlog",
      isRecurring: false,
      recurrenceRule: null,
      reminderLeadDays: 1,
      captureSource: "reminders",
      captureTranscript: null,
      needsCategory: true,
      externalId: item.id,
      completedAt: null,
    });

    existing.add(item.id);
    imported += 1;
  }

  return NextResponse.json({ imported, skipped });
}

interface InboxItem {
  id: string;
  title: string;
  due: string | null;
  notes: string | null;
}

/** Null when the shape is wrong, so the caller gets a 400 and not a 500. */
function parseItems(body: unknown): InboxItem[] | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = (body as { items?: unknown }).items;
  if (!Array.isArray(raw)) return null;

  const items: InboxItem[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (title === "") continue;

    // Fall back to the title when the source has no id of its own: a
    // reminder with the same text is the same reminder for our purposes,
    // and that beats importing it fresh every single day.
    const id =
      typeof record.id === "string" && record.id.trim() !== ""
        ? record.id.trim()
        : `title:${title.toLowerCase()}`;

    const dueRaw = record.due;
    const due =
      typeof dueRaw === "string" && !Number.isNaN(Date.parse(dueRaw))
        ? new Date(dueRaw).toISOString()
        : null;

    items.push({
      id,
      title: title.slice(0, 300),
      due,
      notes: typeof record.notes === "string" && record.notes.trim() !== ""
        ? record.notes.trim().slice(0, 2000)
        : null,
    });
  }

  return items;
}

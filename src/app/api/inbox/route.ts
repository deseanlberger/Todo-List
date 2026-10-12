import { NextResponse } from "next/server";
import { sortReminders } from "@/lib/capture/sort";
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
 * Arrivals are sorted into categories on the way in, and anything the sort
 * is not sure about keeps `needsCategory` so the app still asks. Category
 * decides block size, what window a task may sit in, and how it ranks, so a
 * wrong answer here is expensive — which is why the sorter is allowed to say
 * it does not know rather than being forced to pick. With no Anthropic
 * credentials configured, nothing is confident and every item queues for a
 * tap, which is how this endpoint behaved before it could sort at all.
 *
 * Body: { items: [{ id, title, due? , notes? }] }
 *   id    a stable id from the source. The same reminder posted twice is
 *         ignored the second time, which is what makes a daily re-post of
 *         the whole list safe.
 *   due   ISO 8601, or omitted.
 *   done  true when the reminder has been ticked off. Those close the task
 *         they became rather than creating one, which is what makes ticking
 *         something off on the watch reach the app and the calendar.
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
  const [tasks, history] = await Promise.all([repo.listTasks(), repo.listEstimationHistory(50)]);

  const byExternalId = new Map(
    tasks.filter((task) => task.externalId).map((task) => [task.externalId as string, task]),
  );
  const existing = new Set(byExternalId.keys());

  // Ticked off on the phone, the watch, or in Reminders on the Mac. Close
  // the task it became. A completion for something never imported, or
  // already closed, is nothing to do: the point is to converge, not to
  // count. Nothing is created from a completed reminder, so a task deleted
  // here cannot be resurrected by its reminder still sitting in the list.
  let completed = 0;
  for (const item of items) {
    if (!item.done) continue;
    const task = byExternalId.get(item.id);
    if (!task || task.status === "done") continue;
    await repo.updateTask(task.id, {
      status: "done",
      completedAt: new Date().toISOString(),
    });
    completed += 1;
  }

  // Drop the repeats before sorting: a daily re-post of the whole list is
  // the expected shape, and re-sorting thirty known reminders every morning
  // would burn tokens to reach the same answer.
  const fresh = items.filter((item) => !item.done && !existing.has(item.id));
  const skipped = items.length - fresh.length - completed;

  const sorted = await sortReminders(
    fresh.map((item) => ({
      id: item.id,
      title: item.title,
      notes: item.notes,
      due: item.due,
      list: item.list,
    })),
    history,
    new Date(),
  );

  let imported = 0;
  let needsReview = 0;

  for (const item of fresh) {
    // Already imported inside this same request: the body can repeat an id.
    if (existing.has(item.id)) continue;

    const decision = sorted.get(item.id);
    const confident = decision?.confident ?? false;

    await repo.createTask({
      title: item.title,
      notes: item.notes,
      category: decision?.category ?? "low_priority_admin",
      location: decision?.location ?? "home",
      estimatedBlocks: decision?.estimatedBlocks ?? 1,
      actualBlocks: null,
      dueDate: item.due,
      financialImpact: decision?.financialImpact ?? 3,
      assignee: decision?.assignee ?? null,
      handedOffAt: null,
      status: "backlog",
      isRecurring: false,
      recurrenceRule: null,
      reminderLeadDays: 1,
      captureSource: "reminders",
      captureTranscript: null,
      // The sort's own verdict. Unconfident keeps it on the sort queue.
      needsCategory: !confident,
      externalId: item.id,
      completedAt: null,
    });

    existing.add(item.id);
    imported += 1;
    if (!confident) needsReview += 1;
  }

  return NextResponse.json({
    imported,
    completed,
    skipped,
    sorted: imported - needsReview,
    needsReview,
  });
}

interface InboxItem {
  id: string;
  title: string;
  due: string | null;
  notes: string | null;
  /** The Reminders.app list it came from. The strongest signal we get. */
  list: string | null;
  /** Ticked off at the source. Closes a task rather than creating one. */
  done: boolean;
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
      list: typeof record.list === "string" && record.list.trim() !== ""
        ? record.list.trim().slice(0, 200)
        : null,
      done: record.done === true,
    });
  }

  return items;
}

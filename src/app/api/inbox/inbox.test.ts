import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/domain/types";

/**
 * Ticking a reminder off has to reach the app.
 *
 * It did not, for the whole first month: the Mac reader skipped completed
 * reminders outright, so a task finished on the phone or the watch stayed
 * open here forever and the calendar event it owned never cleared. The
 * contract under test is the close path, and the two ways it could do harm:
 * creating work from something already finished, and closing the wrong row.
 */

const store = vi.hoisted(() => ({
  tasks: [] as Task[],
  created: [] as { title: string; externalId: string | null }[],
  updated: [] as { id: string; patch: Record<string, unknown> }[],
}));

vi.mock("@/lib/data", () => ({
  repository: () => ({
    listTasks: async () => store.tasks,
    listEstimationHistory: async () => [],
    createTask: async (task: { title: string; externalId: string | null }) => {
      store.created.push({ title: task.title, externalId: task.externalId });
    },
    updateTask: async (id: string, patch: Record<string, unknown>) => {
      store.updated.push({ id, patch });
    },
  }),
}));

// The sorter reaches for Anthropic credentials and the network. Neither
// exists here, and neither is what this file is about.
vi.mock("@/lib/capture/sort", () => ({
  sortReminders: async () => new Map(),
}));

function task(partial: Partial<Task> & { id: string; externalId: string }): Task {
  return {
    userId: "desean",
    title: partial.id,
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
    captureSource: "reminders",
    captureTranscript: null,
    needsCategory: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    ...partial,
  };
}

async function post(items: unknown[]) {
  const { POST } = await import("./route");
  const request = new Request("http://localhost/api/inbox", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-secret",
    },
    body: JSON.stringify({ items }),
  });
  const response = await POST(request);
  return (await response.json()) as {
    imported: number;
    completed: number;
    skipped: number;
  };
}

describe("a reminder ticked off at the source", () => {
  beforeEach(() => {
    process.env.INBOX_SECRET = "test-secret";
    store.tasks = [];
    store.created = [];
    store.updated = [];
    vi.resetModules();
  });

  it("closes the task it became", async () => {
    store.tasks = [task({ id: "task-1", externalId: "rem-1", title: "Order chalk" })];

    const body = await post([{ id: "rem-1", title: "Order chalk", done: true }]);

    expect(body.completed).toBe(1);
    expect(store.updated).toHaveLength(1);
    expect(store.updated[0].id).toBe("task-1");
    expect(store.updated[0].patch.status).toBe("done");
    expect(store.updated[0].patch.completedAt).toEqual(expect.any(String));
  });

  it("never creates work from something already finished", async () => {
    // The dangerous shape: a completed reminder the app has never seen.
    // Importing it would put finished work back on his calendar.
    const body = await post([{ id: "rem-unknown", title: "Done before we existed", done: true }]);

    expect(store.created).toEqual([]);
    expect(body.imported).toBe(0);
    expect(body.completed).toBe(0);
  });

  it("leaves a task that is already done alone", async () => {
    store.tasks = [
      task({ id: "task-1", externalId: "rem-1", status: "done", completedAt: "2026-10-01T00:00:00.000Z" }),
    ];

    const body = await post([{ id: "rem-1", title: "rem-1", done: true }]);

    expect(store.updated).toEqual([]);
    expect(body.completed).toBe(0);
  });

  it("closes only the task whose id matches", async () => {
    store.tasks = [
      task({ id: "task-1", externalId: "rem-1" }),
      task({ id: "task-2", externalId: "rem-2" }),
    ];

    await post([{ id: "rem-2", title: "rem-2", done: true }]);

    expect(store.updated.map((row) => row.id)).toEqual(["task-2"]);
  });

  it("imports the open ones and closes the done ones in the same post", async () => {
    store.tasks = [task({ id: "task-1", externalId: "rem-1" })];

    const body = await post([
      { id: "rem-1", title: "rem-1", done: true },
      { id: "rem-2", title: "Something new" },
    ]);

    expect(body.completed).toBe(1);
    expect(body.imported).toBe(1);
    expect(store.created.map((row) => row.externalId)).toEqual(["rem-2"]);
  });

  it("does not count a completion as a skipped duplicate", async () => {
    store.tasks = [task({ id: "task-1", externalId: "rem-1" })];

    const body = await post([{ id: "rem-1", title: "rem-1", done: true }]);

    expect(body.skipped).toBe(0);
  });
});

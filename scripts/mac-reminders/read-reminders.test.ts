import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * The Reminders reader, exercised against a stubbed JXA bridge.
 *
 * It only ever runs on a Mac, against Reminders.app, through Apple Events —
 * none of which exist in CI or in the container this was written in. What
 * CAN be tested is every decision the script makes once the data is in
 * hand: what counts as a task, what gets dropped, what happens when one
 * list is unreadable. That is the part that would quietly send the wrong
 * thing, so it is the part under test.
 *
 * The Apple Event layer itself is still only verifiable by running it on a
 * real Mac.
 */

interface Row {
  name: string | null;
  completed: boolean;
  id: string | null;
  dueDate: Date | null;
  body: string | null;
}

/**
 * A reminder list that answers bulk property reads the way JXA does:
 * `list.reminders.name()` returns the whole column at once.
 */
function makeList(rows: Row[], throwOn?: keyof Row) {
  const column = (key: keyof Row) => () => {
    if (throwOn === key) throw new Error(`boom: ${key}`);
    return rows.map((row) => row[key]);
  };
  return {
    reminders: {
      name: column("name"),
      completed: column("completed"),
      id: column("id"),
      dueDate: column("dueDate"),
      body: column("body"),
    },
  };
}

interface Payload {
  items: { title: string; due: string | null; notes: string | null; id?: string }[];
  problems?: string[];
  error?: string;
}

function runReader(lists: unknown[], listsThrow = false): Payload {
  const source = readFileSync(
    new URL("./read-reminders.js", import.meta.url),
    "utf8",
  );
  const sandbox = {
    Application: () => ({
      lists: () => {
        if (listsThrow) throw new Error("Not authorized to send Apple events");
        return lists;
      },
    }),
    Date,
    JSON,
    String,
    Object,
    __out: "",
  };
  createContext(sandbox);
  runInContext(`${source}\n;globalThis.__out = run();`, sandbox);
  return JSON.parse(sandbox.__out) as Payload;
}

describe("reading reminders off a Mac", () => {
  it("keeps open work and drops what is already done", () => {
    const out = runReader([
      makeList([
        { name: "Write SMHS volleyball block 3", completed: false, id: "1", dueDate: new Date("2026-10-15T17:00:00Z"), body: null },
        { name: "Already did this", completed: true, id: "2", dueDate: null, body: null },
        { name: "Order chalk", completed: false, id: "3", dueDate: null, body: "the good kind" },
      ]),
    ]);

    expect(out.items.map((item) => item.title)).toEqual([
      "Write SMHS volleyball block 3",
      "Order chalk",
    ]);
  });

  it("converts a due date to ISO and leaves a missing one null", () => {
    const out = runReader([
      makeList([
        { name: "Has a date", completed: false, id: "1", dueDate: new Date("2026-10-15T17:00:00Z"), body: null },
        { name: "Has none", completed: false, id: "2", dueDate: null, body: null },
      ]),
    ]);

    expect(out.items[0].due).toBe("2026-10-15T17:00:00.000Z");
    expect(out.items[1].due).toBeNull();
  });

  it("carries notes through, since the category often hides there", () => {
    const out = runReader([
      makeList([
        { name: "Thursday", completed: false, id: "1", dueDate: null, body: "  write the phase 2 program  " },
      ]),
    ]);

    expect(out.items[0].notes).toBe("write the phase 2 program");
  });

  it("does not treat a blank or whitespace title as a task", () => {
    const out = runReader([
      makeList([
        { name: "   ", completed: false, id: "a", dueDate: null, body: null },
        { name: null, completed: false, id: "b", dueDate: null, body: null },
        { name: "  Real one  ", completed: false, id: "c", dueDate: null, body: null },
      ]),
    ]);

    expect(out.items.map((item) => item.title)).toEqual(["Real one"]);
  });

  it("omits a missing id rather than sending a blank one", () => {
    // A blank id shared by every failed read would collapse them into one
    // task on the server. No id at all makes it fall back to the title.
    const out = runReader([
      makeList([{ name: "No id here", completed: false, id: null, dueDate: null, body: null }]),
    ]);

    expect(out.items[0]).not.toHaveProperty("id");
    expect(out.items[0].title).toBe("No id here");
  });

  it("merges every list", () => {
    const out = runReader([
      makeList([{ name: "From list A", completed: false, id: "a", dueDate: null, body: null }]),
      makeList([{ name: "From list B", completed: false, id: "b", dueDate: null, body: null }]),
    ]);

    expect(out.items.map((item) => item.title)).toEqual(["From list A", "From list B"]);
  });

  it("loses one unreadable list, not the whole morning", () => {
    const out = runReader([
      makeList([{ name: "survivor", completed: false, id: "a", dueDate: null, body: null }]),
      makeList([{ name: "doomed", completed: false, id: "b", dueDate: null, body: null }], "id"),
    ]);

    expect(out.items.map((item) => item.title)).toEqual(["survivor"]);
    expect(out.problems).toHaveLength(1);
  });

  it("reports a permission failure instead of posting an empty list", () => {
    // The whole point: a denied automation prompt must be loud. Silently
    // posting {items: []} every morning looks exactly like "no new work".
    const out = runReader([], true);

    expect(out.items).toEqual([]);
    expect(out.error).toContain("Could not read Reminders");
  });

  it("handles an empty list", () => {
    expect(runReader([makeList([])]).items).toEqual([]);
  });
});

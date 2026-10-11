import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The sorter's job is not "always pick a category" — it is "pick one when the
 * text supports it, and admit it when it does not". A confident wrong answer
 * puts a task in the wrong length of block, in a window it does not belong
 * in, and Desean does not find out until the day runs wrong. So these tests
 * care as much about the `confident` flag as the category.
 */

const NOW = new Date("2026-10-12T16:00:00Z");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function sortWithoutClaude(
  items: { id: string; title: string; notes?: string | null; due?: string | null }[],
) {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
  const { sortReminders } = await import("./sort");
  return sortReminders(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      notes: item.notes ?? null,
      due: item.due ?? null,
    })),
    [],
    NOW,
  );
}

describe("sorting with no Anthropic credentials", () => {
  it("returns a row for every reminder rather than dropping any", async () => {
    const sorted = await sortWithoutClaude([
      { id: "a", title: "Write SMHS volleyball block 3" },
      { id: "b", title: "Order chalk" },
      { id: "c", title: "Thibodo" },
    ]);

    expect([...sorted.keys()].sort()).toEqual(["a", "b", "c"]);
  });

  it("marks everything unconfident, because keywords are not good enough to schedule on", async () => {
    const sorted = await sortWithoutClaude([
      { id: "a", title: "Write SMHS volleyball block 3" },
      { id: "b", title: "Pay the rent" },
    ]);

    for (const decision of sorted.values()) {
      expect(decision.confident).toBe(false);
    }
  });

  it("still makes a usable guess so the confirm is one tap and not a blank form", async () => {
    const sorted = await sortWithoutClaude([
      { id: "a", title: "Write the Montana Western volleyball program" },
    ]);

    expect(sorted.get("a")).toMatchObject({
      category: "deep_focus",
      location: "home",
    });
  });

  it("reads the notes as well as the title", async () => {
    const withNotes = await sortWithoutClaude([
      { id: "a", title: "Thursday", notes: "Need to write the phase 2 program" },
    ]);
    expect(withNotes.get("a")?.category).toBe("deep_focus");

    const withoutNotes = await sortWithoutClaude([{ id: "a", title: "Thursday" }]);
    expect(withoutNotes.get("a")?.category).toBe("low_priority_admin");
  });

  it("never returns a delegate task with more than one block", async () => {
    const sorted = await sortWithoutClaude([{ id: "a", title: "Ask Ty to run the 4pm" }]);
    const decision = sorted.get("a")!;
    expect(decision.category).toBe("delegate");
    expect(decision.estimatedBlocks).toBe(1);
  });

  it("handles an empty batch without calling anything", async () => {
    const sorted = await sortWithoutClaude([]);
    expect(sorted.size).toBe(0);
  });

  it("survives a reminder that is only punctuation", async () => {
    const sorted = await sortWithoutClaude([{ id: "a", title: "???" }]);
    expect(sorted.get("a")).toMatchObject({ confident: false });
    expect(sorted.get("a")?.estimatedBlocks).toBeGreaterThanOrEqual(1);
  });
});

describe("sorting when Claude answers", () => {
  const parse = vi.hoisted(() => ({ impl: null as null | (() => unknown) }));

  vi.mock("@anthropic-ai/sdk", () => ({
    default: class {
      messages = {
        parse: async () => parse.impl!(),
      };
    },
  }));

  async function sortWithClaude(
    items: { id: string; title: string }[],
    impl: () => unknown,
  ) {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    parse.impl = impl;
    const { sortReminders } = await import("./sort");
    return sortReminders(
      items.map((item) => ({ id: item.id, title: item.title, notes: null, due: null })),
      [],
      NOW,
    );
  }

  it("takes the model's answer, confidence included", async () => {
    const sorted = await sortWithClaude([{ id: "a", title: "Pay payroll" }], () => ({
      parsed_output: {
        reminders: [
          {
            id: "a",
            category: "high_priority_admin",
            location: "home",
            estimatedBlocks: 1,
            financialImpact: 5,
            assignee: null,
            confident: true,
          },
        ],
      },
    }));

    expect(sorted.get("a")).toEqual({
      category: "high_priority_admin",
      location: "home",
      estimatedBlocks: 1,
      financialImpact: 5,
      assignee: null,
      confident: true,
    });
  });

  it("ignores a row for an id it never sent", async () => {
    // A hallucinated id must not create a decision about a task that does
    // not exist, and must not shadow the real one.
    const sorted = await sortWithClaude([{ id: "a", title: "Order bands" }], () => ({
      parsed_output: {
        reminders: [
          {
            id: "not-a-real-id",
            category: "deep_focus",
            location: "home",
            estimatedBlocks: 4,
            financialImpact: 5,
            assignee: null,
            confident: true,
          },
        ],
      },
    }));

    expect(sorted.has("not-a-real-id")).toBe(false);
    expect(sorted.get("a")?.confident).toBe(false);
  });

  it("falls back for a reminder the model skipped", async () => {
    const sorted = await sortWithClaude(
      [
        { id: "a", title: "Pay payroll" },
        { id: "b", title: "Write the softball block" },
      ],
      () => ({
        parsed_output: {
          reminders: [
            {
              id: "a",
              category: "high_priority_admin",
              location: "home",
              estimatedBlocks: 1,
              financialImpact: 5,
              assignee: null,
              confident: true,
            },
          ],
        },
      }),
    );

    expect(sorted.get("a")?.confident).toBe(true);
    // Present, guessed, and flagged for a tap.
    expect(sorted.get("b")).toMatchObject({ category: "deep_focus", confident: false });
  });

  it("does not lose the batch when the call throws", async () => {
    const sorted = await sortWithClaude(
      [
        { id: "a", title: "Pay payroll" },
        { id: "b", title: "Order chalk" },
      ],
      () => {
        throw new Error("502 from the API");
      },
    );

    expect(sorted.size).toBe(2);
    expect(sorted.get("a")?.confident).toBe(false);
    expect(sorted.get("b")?.confident).toBe(false);
  });

  it("clamps a delegate task the model over-estimated", async () => {
    const sorted = await sortWithClaude([{ id: "a", title: "Have Jake cover Tuesday" }], () => ({
      parsed_output: {
        reminders: [
          {
            id: "a",
            category: "delegate",
            location: "gym",
            estimatedBlocks: 6,
            financialImpact: 3,
            assignee: "Jake",
            confident: true,
          },
        ],
      },
    }));

    expect(sorted.get("a")).toMatchObject({ estimatedBlocks: 1, assignee: "Jake" });
  });

  it("drops an assignee the model attached to a non-delegate task", async () => {
    const sorted = await sortWithClaude([{ id: "a", title: "Call Annie back" }], () => ({
      parsed_output: {
        reminders: [
          {
            id: "a",
            category: "high_priority_admin",
            location: "home",
            estimatedBlocks: 1,
            financialImpact: 4,
            assignee: "Annie",
            confident: true,
          },
        ],
      },
    }));

    expect(sorted.get("a")?.assignee).toBeNull();
  });
});

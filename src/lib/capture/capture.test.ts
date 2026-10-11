import { describe, expect, it } from "vitest";
import { heuristicParse } from "./parse";
import { CaptureSchema } from "./schema";

const NOW = new Date("2026-09-03T19:00:00Z");

function parse(text: string) {
  return heuristicParse({ text, history: [], now: NOW });
}

describe("capture fallback parser", () => {
  it("splits a multi-task message into separate tasks", () => {
    const tasks = parse(
      "Run payroll before Wednesday. Also I need to re-tape the platform edges.",
    );
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe("Run payroll before Wednesday");
    expect(tasks[1].title).toContain("re-tape the platform edges");
  });

  it("reads payroll as high priority admin at home, impact 5", () => {
    const [task] = parse("Run payroll for the second half of August");
    expect(task.category).toBe("high_priority_admin");
    expect(task.location).toBe("home");
    expect(task.financialImpact).toBe(5);
    expect(task.estimatedBlocks).toBe(1);
  });

  it("reads program writing as deep focus at home with the cold-start estimate", () => {
    const [task] = parse("Write the SMHS volleyball block");
    expect(task.category).toBe("deep_focus");
    expect(task.location).toBe("home");
    // §16 cold-start default: deep focus is 2 blocks.
    expect(task.estimatedBlocks).toBe(2);
  });

  it("reads facility work as gym", () => {
    const [task] = parse("Fix the squat rack pin");
    expect(task.location).toBe("gym");
    expect(task.category).toBe("low_priority_admin");
  });

  it("routes a named coach to delegate with an assignee", () => {
    const [task] = parse("Get Annie to chase the Boise State film request");
    expect(task.category).toBe("delegate");
    expect(task.assignee).toBe("Annie");
    // The schema forbids a delegate task claiming more than one block.
    expect(task.estimatedBlocks).toBe(1);
  });

  it("never invents a due date the message did not mention", () => {
    expect(parse("Order chalk and bands")[0].dueDate).toBeNull();
  });

  it("ignores fragments too short to be a task", () => {
    expect(parse("ok. hi. Run payroll")).toHaveLength(1);
  });

  it("produces output the capture schema accepts", () => {
    const tasks = parse("Write the Montana Western block and pay the rent");
    expect(CaptureSchema.safeParse({ tasks }).success).toBe(true);
  });
});

describe("a coach's name is not a handoff", () => {
  const now = new Date("2026-10-11T16:00:00Z");
  const sort = (text: string) => heuristicParse({ text, history: [], now })[0];

  it("treats a leading 'Name:' as the subject, not the assignee", () => {
    // Desean's real reminders read like this, and their own notes say
    // "Ask Claude to vald-pull her numbers" — his job, her data. He
    // confirmed it directly. Reading the name as a handoff filed seven of
    // his twelve reminders as delegated work that would never be scheduled.
    for (const title of [
      "D'Lainey: check force plate numbers (test 1)",
      "D'Lainey: end of Block 1, check her programming",
      "Ty: review his squat video",
    ]) {
      expect(sort(title).category, title).not.toBe("delegate");
      expect(sort(title).assignee, title).toBeNull();
    }
  });

  it("still catches an actual handoff", () => {
    const cases: [string, string][] = [
      ["Have Ty cover the 4pm Tuesday", "Ty"],
      ["Ask Jake to reset the platforms", "Jake"],
      ["Get Megan to run the adult class", "Megan"],
      ["Hand it off to Matthew", "Matthew"],
      ["Tell Annie to call the Breakers parent back", "Annie"],
      ["Ty can cover Tuesday", "Ty"],
    ];
    for (const [text, who] of cases) {
      const task = sort(text);
      expect(task.category, text).toBe("delegate");
      expect(task.assignee?.toLowerCase(), text).toBe(who.toLowerCase());
    }
  });

  it("leaves work that mentions nobody alone", () => {
    expect(sort("Return the chair to Costco").category).not.toBe("delegate");
    expect(sort("Order more chalk").category).not.toBe("delegate");
  });
});

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

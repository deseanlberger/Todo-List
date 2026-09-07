import { z } from "zod";

/**
 * What Claude must return for a captured message. One entry per task — a
 * single voice note often contains several (§17).
 */
export const CapturedTaskSchema = z.object({
  title: z
    .string()
    .describe("Short, sentence case, no trailing period. The task itself, not the sentence around it."),
  category: z
    .enum([
      "deep_focus",
      "high_priority_admin",
      "low_priority_admin",
      "personal",
      "delegate",
    ])
    .describe("Exactly one bucket."),
  location: z
    .enum(["gym", "home"])
    .describe("Where the work physically happens."),
  dueDate: z
    .string()
    .nullable()
    .describe("ISO 8601 timestamp, or null when no deadline was mentioned."),
  financialImpact: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("1 is a shelf, 5 is payroll or rent."),
  estimatedBlocks: z
    .number()
    .int()
    .min(1)
    .max(8)
    .describe("Your estimate. Never ask the user for it."),
  assignee: z
    .string()
    .nullable()
    .describe("Only for delegate tasks: the coach's first name. Null otherwise."),
});

export const CaptureSchema = z.object({
  tasks: z.array(CapturedTaskSchema),
});

export type CapturedTask = z.infer<typeof CapturedTaskSchema>;
export type Capture = z.infer<typeof CaptureSchema>;

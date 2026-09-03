import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { CATEGORIES } from "@/lib/domain/categories";
import { DEFAULT_TIME_ZONE, WEEKDAY_FULL, zonedParts } from "@/lib/domain/time";
import type { EstimationSample, TaskCategory, TaskLocation } from "@/lib/domain/types";
import { CaptureSchema, type CapturedTask } from "./schema";

/**
 * Structured extraction is the whole job here, so the model is asked for a
 * schema-validated object rather than prose it might wrap in commentary.
 */
const MODEL = "claude-opus-5";

export function claudeIsConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export interface ParseInput {
  text: string;
  /** Most recent 30-50 completions, as §16 requires. */
  history: EstimationSample[];
  now: Date;
  timeZone?: string;
}

/**
 * SCHEDULER_RULES §17.3. Turn one captured message into structured tasks.
 *
 * Falls back to a deterministic keyword parser when no Anthropic credentials
 * are configured, so the bot still captures something rather than dropping
 * the message on the floor.
 */
export async function parseCapture(input: ParseInput): Promise<CapturedTask[]> {
  if (!claudeIsConfigured()) return heuristicParse(input);

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      // Capture must feel instant, and this is a small extraction — the
      // depth is not what makes it correct, the rules in the prompt are.
      output_config: {
        effort: "low",
        format: zodOutputFormat(CaptureSchema),
      },
      system: systemPrompt(input),
      messages: [{ role: "user", content: input.text }],
    });

    const parsed = response.parsed_output;
    if (!parsed || parsed.tasks.length === 0) return heuristicParse(input);

    return parsed.tasks.map(normalise);
  } catch (cause) {
    // A capture that fails is worse than a capture that is roughly right:
    // the user has already spoken and moved on.
    console.error("Capture parse failed, falling back to keywords:", cause);
    return heuristicParse(input);
  }
}

function systemPrompt(input: ParseInput): string {
  const timeZone = input.timeZone ?? CALENDAR_TIME_ZONE ?? DEFAULT_TIME_ZONE;
  const parts = zonedParts(input.now, timeZone);
  const today = `${WEEKDAY_FULL[parts.weekday]}, ${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;

  const examples = input.history
    .slice(0, 50)
    .map(
      (sample) =>
        `- "${sample.title}" (${sample.category}): estimated ${sample.estimatedBlocks}, actually took ${sample.actualBlocks}`,
    )
    .join("\n");

  return `You turn captured messages from a strength coach into structured tasks for his scheduler.

Today is ${today}. His timezone is ${timeZone}. He owns a private strength and conditioning gym and also contracts with high school and college teams.

Split the message into separate tasks when it contains more than one. A single errand is one task.

CATEGORIES — pick exactly one:
- deep_focus: writing programs, anything needing real uninterrupted thinking. 45 minutes a block.
- high_priority_admin: business items with a deadline — payroll, invoices, contracts, a call he owes someone. 30 minutes a block.
- low_priority_admin: gym housekeeping and nice-to-haves — ordering supplies, fixing equipment, tidying. 30 minutes a block.
- personal: anything not business. 30 minutes a block.
- delegate: something to hand to a coach rather than do himself. Set assignee to the person's first name.

LOCATION:
- gym: maintenance, equipment, facility, anything physically tied to the building, anything about a session on the floor.
- home: programming, email, finances, and most admin.

DUE DATE:
- Only when the message actually mentions timing. "Before Wednesday" means that Wednesday at 17:00 local. "Tomorrow" means the next day at 17:00 local. No mention means null.
- Return a full ISO 8601 timestamp with an offset.

FINANCIAL IMPACT, 1 to 5:
- 5: payroll, rent, anything that costs real money if it slips.
- 4: client-facing commitments, contracts, invoices.
- 3: normal business work.
- 2: helpful but not urgent.
- 1: tidying, reorganising.

ESTIMATED BLOCKS — guess it, never ask. Cold-start defaults are 2 blocks for deep focus and 1 for everything else. Delegate tasks are always 1.
${examples ? `\nHis actual history, use it to calibrate:\n${examples}` : ""}

Write the title as he would say it, in sentence case, with no trailing period.`;
}

function normalise(task: CapturedTask): CapturedTask {
  const meta = CATEGORIES[task.category];
  return {
    ...task,
    title: task.title.trim().replace(/\.$/, ""),
    estimatedBlocks: meta.schedules ? clamp(task.estimatedBlocks, 1, 8) : 1,
    financialImpact: clamp(task.financialImpact, 1, 5),
    assignee: task.category === "delegate" ? task.assignee : null,
    dueDate: task.dueDate && !Number.isNaN(Date.parse(task.dueDate)) ? task.dueDate : null,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/* --------------------------------------------------------------- fallback */

const GYM_WORDS = [
  "rack", "platform", "turf", "gym", "equipment", "bar", "plates", "chalk",
  "clean", "floor", "sled", "band", "dumbbell", "machine", "facility", "fix",
  "repair", "order",
];

const DEEP_FOCUS_WORDS = [
  "program", "programming", "block", "write", "macrocycle", "phase", "plan",
  "design", "build out",
];

const HIGH_PRIORITY_WORDS = [
  "payroll", "rent", "invoice", "contract", "pay", "bill", "call back", "email back",
  "deadline", "taxes", "renew",
];

const PERSONAL_WORDS = ["dentist", "doctor", "birthday", "family", "haircut", "lift"];

const DELEGATE_WORDS = ["annie", "jake", "ty", "matthew", "michael", "megan", "d'lainey", "dlainey"];

/**
 * No credentials, no problem: keyword matching gets the task into the
 * backlog with a reasonable guess, and every field is one tap to fix.
 */
export function heuristicParse(input: ParseInput): CapturedTask[] {
  return splitSentences(input.text).map((sentence) => {
    const lower = sentence.toLowerCase();

    const assignee = DELEGATE_WORDS.find((name) => lower.includes(name)) ?? null;
    const category: TaskCategory = assignee
      ? "delegate"
      : match(lower, DEEP_FOCUS_WORDS)
        ? "deep_focus"
        : match(lower, HIGH_PRIORITY_WORDS)
          ? "high_priority_admin"
          : match(lower, PERSONAL_WORDS)
            ? "personal"
            : "low_priority_admin";

    const location: TaskLocation =
      category === "deep_focus" ? "home" : match(lower, GYM_WORDS) ? "gym" : "home";

    return {
      title: capitalise(sentence.trim().replace(/\.$/, "")),
      category,
      location,
      dueDate: null,
      financialImpact: match(lower, HIGH_PRIORITY_WORDS) ? 5 : 2,
      // Cold-start defaults from §16.
      estimatedBlocks: category === "deep_focus" ? 2 : 1,
      assignee: assignee ? capitalise(assignee) : null,
    };
  });
}

function splitSentences(text: string): string[] {
  return text
    .split(/[\n.;]+|,? and (?=then |also |I )|\band also\b/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2)
    .slice(0, 8);
}

function match(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { CATEGORIES, defaultBlocks } from "@/lib/domain/categories";
import { DEFAULT_TIME_ZONE } from "@/lib/domain/time";
import type { EstimationSample, TaskCategory, TaskLocation } from "@/lib/domain/types";
import {
  TAXONOMY_RULES,
  claudeIsConfigured,
  heuristicParse,
  historyLines,
  todayLine,
} from "./parse";

/**
 * Sorting reminders into categories.
 *
 * This is a different job from voice capture, even though it picks from the
 * same buckets. A voice note is a sentence he spoke on purpose and may hold
 * several tasks. A reminder is one line he typed to himself months ago, is
 * always exactly one task, and is often too thin to classify at all:
 * "Thibodo" is a real reminder and nothing can tell you what it means.
 *
 * So the model is given an explicit way to say it does not know. An
 * unconfident answer keeps `needsCategory` set, which leaves the task on
 * Today's "From Reminders" list for one tap — the auto-sort then saves him
 * the obvious ones without silently guessing the ambiguous ones into the
 * wrong block size and the wrong window.
 */

const MODEL = "claude-opus-5";

/** One reminder going in. */
export interface ReminderToSort {
  id: string;
  title: string;
  notes: string | null;
  due: string | null;
}

/** What we decided about it. */
export interface SortedReminder {
  category: TaskCategory;
  location: TaskLocation;
  estimatedBlocks: number;
  financialImpact: number;
  assignee: string | null;
  /**
   * True only when the sort is good enough to act on unreviewed. False keeps
   * the task in the sort queue, which is also where everything lands when
   * Claude is not configured at all.
   */
  confident: boolean;
}

const SortedSchema = z.object({
  id: z.string().describe("Copy the id you were given, exactly."),
  category: z
    .enum(["deep_focus", "high_priority_admin", "low_priority_admin", "personal", "delegate"])
    .describe("Exactly one bucket."),
  location: z.enum(["gym", "home"]).describe("Where the work physically happens."),
  estimatedBlocks: z.number().int().min(1).max(8),
  financialImpact: z.number().int().min(1).max(5),
  assignee: z
    .string()
    .nullable()
    .describe("Only for delegate tasks: the coach's first name. Null otherwise."),
  confident: z
    .boolean()
    .describe(
      "True only if the text genuinely tells you what this work is. False for a bare name, a single word, an abbreviation, or anything you are filling in by assumption. Guessing wrong costs him a misplaced block, so prefer false when torn.",
    ),
});

const SortBatchSchema = z.object({ reminders: z.array(SortedSchema) });

/**
 * Sort a batch of reminders, keyed by id.
 *
 * One call for the whole batch rather than one per reminder: it is cheaper,
 * it is faster on a morning import of thirty items, and the model can see
 * that "Order bands" and "Order chalk" are the same kind of errand.
 *
 * Never throws. Anything it cannot sort confidently comes back from the
 * keyword fallback marked unconfident, because an import that fails is worse
 * than an import that lands in the sort queue.
 */
export async function sortReminders(
  items: ReminderToSort[],
  history: EstimationSample[],
  now: Date,
  timeZone: string = CALENDAR_TIME_ZONE ?? DEFAULT_TIME_ZONE,
): Promise<Map<string, SortedReminder>> {
  const sorted = new Map<string, SortedReminder>();
  if (items.length === 0) return sorted;

  // No credentials: everything goes to the queue with a keyword guess.
  if (!claudeIsConfigured()) {
    for (const item of items) sorted.set(item.id, fallback(item, now));
    return sorted;
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      output_config: {
        effort: "low",
        format: zodOutputFormat(SortBatchSchema),
      },
      system: systemPrompt(history, now, timeZone),
      messages: [{ role: "user", content: JSON.stringify({ reminders: items }) }],
    });

    for (const entry of response.parsed_output?.reminders ?? []) {
      // Ignore an id we never sent: a hallucinated row must not create a
      // decision about a task that does not exist.
      if (!items.some((item) => item.id === entry.id)) continue;
      sorted.set(entry.id, normalise(entry));
    }
  } catch (cause) {
    console.error("Reminder sort failed, falling back to keywords:", cause);
  }

  // Whatever the model skipped or mangled still has to arrive.
  for (const item of items) {
    if (!sorted.has(item.id)) sorted.set(item.id, fallback(item, now));
  }

  return sorted;
}

function systemPrompt(history: EstimationSample[], now: Date, timeZone: string): string {
  const examples = historyLines(history);

  return `You sort reminders from a strength coach's Apple Reminders app into his scheduler.

Today is ${todayLine(now, timeZone)}. His timezone is ${timeZone}. He owns a private strength and conditioning gym and also contracts with high school and college teams. His coaches are Ty, Matthew, Jake, Michael, Megan, Annie and D'Lainey.

You are given a JSON array of reminders. Return one row per reminder, echoing its id. Never merge two reminders and never split one: a reminder is exactly one task, however it is worded.

${TAXONOMY_RULES}

CONFIDENCE — this is the part that matters most.
These are lines he typed to himself, sometimes months ago, with no context. Many are too thin to classify. Set confident to false when the text does not actually tell you what the work is: a bare surname, a single noun, an abbreviation, a place, or anything where you are supplying the meaning yourself. An unconfident row still needs your best guess in every other field, but it will be shown to him to confirm rather than acted on.

Be honest here rather than helpful. A wrong confident answer puts the task in the wrong length of block, in a window it does not belong in, and he will not notice until the day runs wrong.
${examples ? `\nHis actual history, use it to calibrate estimates:\n${examples}` : ""}`;
}

function normalise(entry: z.infer<typeof SortedSchema>): SortedReminder {
  const meta = CATEGORIES[entry.category];
  return {
    category: entry.category,
    location: entry.location,
    estimatedBlocks: meta.schedules ? clamp(entry.estimatedBlocks, 1, 8) : 1,
    financialImpact: clamp(entry.financialImpact, 1, 5),
    assignee: entry.category === "delegate" ? entry.assignee : null,
    confident: entry.confident,
  };
}

/**
 * The keyword parser, reused on one reminder.
 *
 * Always unconfident: keyword matching is good enough to pre-fill a form and
 * nowhere near good enough to schedule unreviewed.
 */
function fallback(item: ReminderToSort, now: Date): SortedReminder {
  const text = item.notes ? `${item.title}. ${item.notes}` : item.title;

  // heuristicParse is built for voice capture, so it splits its input into
  // several tasks. A reminder is always exactly one, and the signal is as
  // likely to be in the notes as the title: "Thursday" with a note saying
  // "write the phase 2 program" is deep focus, and taking only the first
  // part would file it as admin. So every part is classified and the most
  // specific answer wins — low_priority_admin is this parser's default, not
  // a conclusion, so it only stands when nothing else matched.
  const parts = heuristicParse({ text, history: [], now });
  const guess = parts.find((part) => part.category !== "low_priority_admin") ?? parts[0];

  if (!guess) {
    return {
      category: "low_priority_admin",
      location: "home",
      estimatedBlocks: defaultBlocks("low_priority_admin"),
      financialImpact: 2,
      assignee: null,
      confident: false,
    };
  }

  return {
    category: guess.category,
    location: guess.location,
    estimatedBlocks: guess.estimatedBlocks,
    financialImpact: guess.financialImpact,
    assignee: guess.assignee,
    confident: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

import { blockMinutes } from "@/lib/domain/categories";
import { comparePriority } from "@/lib/domain/priority";
import {
  WEEKDAY_LABELS,
  dayIndexInWeek,
  formatClock,
  formatDueWeekday,
  formatDuration,
  isoDate,
  minutesOfDay,
} from "@/lib/domain/time";
import type { ScheduledBlock, Task } from "@/lib/domain/types";
import type { Conflict, Layout, Placement } from "./place";

/**
 * A diff line is built as parts rather than a string so the UI can render
 * task names in the primary text colour inside an otherwise secondary
 * sentence, without any HTML injection.
 */
export interface SentencePart {
  text: string;
  emphasis?: boolean;
}

export interface DiffMove {
  taskId: string;
  title: string;
  from: { dayIndex: number; start: number };
  to: { dayIndex: number; start: number };
  sentence: SentencePart[];
}

export interface DiffPlacement {
  taskId: string;
  title: string;
  dayIndex: number;
  start: number;
  durationMinutes: number;
  sentence: SentencePart[];
}

export interface DiffRemoval {
  taskId: string;
  title: string;
  gcalEventId: string | null;
  sentence: SentencePart[];
}

export interface DiffConflict {
  taskId: string;
  title: string;
  bumpTitle: string | null;
  sentence: SentencePart[];
}

export interface ScheduleDiff {
  weekStart: string;
  moves: DiffMove[];
  placements: DiffPlacement[];
  removals: DiffRemoval[];
  conflicts: DiffConflict[];
  didntFit: { taskId: string; title: string; blocks: number; category: string }[];
  /** Placed first, never listed, never moved (§11). */
  recurringPlacedCount: number;
  /** The number on the WRITE n CHANGES button. */
  totalChanges: number;
}

export interface BuildDiffInput {
  weekStart: string;
  layout: Layout;
  /** What is on the calendar right now, written by a previous run. */
  currentBlocks: ScheduledBlock[];
  tasksById: Map<string, Task>;
  timeZone: string;
  now: Date;
}

export function buildDiff(input: BuildDiffInput): ScheduleDiff {
  const { weekStart, layout, currentBlocks, tasksById, timeZone, now } = input;

  const current = currentBlocks
    .filter((block) => !block.isResetGap && !block.isDelegation && block.taskId)
    .map((block) => ({
      block,
      taskId: block.taskId!,
      dayIndex: dayIndexInWeek(weekStart, isoDate(new Date(block.startTime), timeZone)),
      start: minutesOfDay(new Date(block.startTime), timeZone),
      end: minutesOfDay(new Date(block.endTime), timeZone),
    }));

  const currentByTask = new Map(current.map((entry) => [entry.taskId, entry]));
  const placementByTask = new Map(layout.placements.map((p) => [p.taskId, p]));

  const moves: DiffMove[] = [];
  const removals: DiffRemoval[] = [];

  for (const entry of current) {
    const task = tasksById.get(entry.taskId);
    const placement = placementByTask.get(entry.taskId);

    if (!placement) {
      removals.push({
        taskId: entry.taskId,
        title: task?.title ?? "Unknown task",
        gcalEventId: entry.block.gcalEventId,
        sentence: [
          { text: "Clearing " },
          { text: task?.title ?? "an unknown task", emphasis: true },
          { text: ` from ${dayLabel(entry.dayIndex)} ${formatClock(entry.start)} — it no longer fits the week.` },
        ],
      });
      continue;
    }

    const moved = placement.dayIndex !== entry.dayIndex || placement.start !== entry.start;
    if (!moved) continue;

    // §11: recurring tasks never appear in the move list.
    if (placement.task.isRecurring) continue;

    moves.push({
      taskId: entry.taskId,
      title: placement.task.title,
      from: { dayIndex: entry.dayIndex, start: entry.start },
      to: { dayIndex: placement.dayIndex, start: placement.start },
      sentence: moveSentence(entry, placement, layout, now, timeZone),
    });
  }

  const placements: DiffPlacement[] = [];
  for (const placement of layout.placements) {
    if (currentByTask.has(placement.taskId)) continue;
    if (placement.task.isRecurring) continue;

    placements.push({
      taskId: placement.taskId,
      title: placement.task.title,
      dayIndex: placement.dayIndex,
      start: placement.start,
      durationMinutes: placement.end - placement.start,
      sentence: placementSentence(placement),
    });
  }

  const conflicts = layout.conflicts.map((conflict) => ({
    taskId: conflict.task.id,
    title: conflict.task.title,
    bumpTitle: conflict.wouldBump?.title ?? null,
    sentence: conflictSentence(conflict, timeZone),
  }));

  return {
    weekStart,
    moves,
    placements,
    removals,
    conflicts,
    didntFit: layout.didntFit.map((task) => ({
      taskId: task.id,
      title: task.title,
      blocks: task.estimatedBlocks,
      category: task.category,
    })),
    recurringPlacedCount: layout.recurringPlaced.length,
    totalChanges: moves.length + placements.length + removals.length,
  };
}

function moveSentence(
  entry: { dayIndex: number; start: number; end: number },
  placement: Placement,
  layout: Layout,
  now: Date,
  timeZone: string,
): SentencePart[] {
  const parts: SentencePart[] = [
    { text: "Moving " },
    { text: placement.task.title, emphasis: true },
    {
      text: ` from ${dayLabel(entry.dayIndex)} ${formatClock(entry.start)} to ${dayLabel(
        placement.dayIndex,
      )} ${formatClock(placement.start)}`,
    },
  ];

  const usurper = findUsurper(entry, placement.taskId, layout, now, timeZone);

  if (usurper) {
    parts.push({ text: " to make room for " });
    parts.push({ text: usurper.task.title, emphasis: true });
    parts.push({
      text: usurper.task.dueDate
        ? `, due ${formatDueWeekday(usurper.task.dueDate, timeZone)}.`
        : ".",
    });
  } else {
    parts.push({ text: " to keep the week's order intact." });
  }

  return parts;
}

/**
 * Which task took the slot this one used to hold? Only a genuinely
 * higher-priority task counts as a reason; anything else and we say the
 * honest, vaguer thing instead of inventing a cause.
 */
function findUsurper(
  entry: { dayIndex: number; start: number; end: number },
  movedTaskId: string,
  layout: Layout,
  now: Date,
  timeZone: string,
): Placement | null {
  const overlapping = layout.placements
    .filter(
      (p) =>
        p.taskId !== movedTaskId &&
        p.dayIndex === entry.dayIndex &&
        p.start < entry.end &&
        p.end > entry.start,
    )
    .sort((a, b) => a.start - b.start);

  const moved = layout.placements.find((p) => p.taskId === movedTaskId);
  if (!moved) return overlapping[0] ?? null;

  return (
    overlapping.find((p) => comparePriority(p.task, moved.task, now, timeZone) < 0) ??
    null
  );
}

function placementSentence(placement: Placement): SentencePart[] {
  const minutes = placement.end - placement.start;
  const parts: SentencePart[] = [
    { text: "Placing " },
    { text: placement.task.title, emphasis: true },
    {
      text: ` ${dayLabel(placement.dayIndex)} ${formatClock(placement.start)}, ${formatDuration(
        minutes,
      ).toLowerCase()}`,
    },
  ];

  if (placement.locationFavourable && placement.gymAnchorStart !== null) {
    parts.push({
      text: ` — you are at the gym from ${formatClock(placement.gymAnchorStart)}.`,
    });
  } else {
    parts.push({ text: `, ${placement.task.location === "gym" ? "Gym" : "Home"}.` });
  }

  return parts;
}

function conflictSentence(conflict: Conflict, timeZone: string): SentencePart[] {
  const due = conflict.task.dueDate
    ? ` due ${formatDueWeekday(conflict.task.dueDate, timeZone)}`
    : "";

  if (!conflict.wouldBump || !conflict.wouldBumpPlacement) {
    return [
      { text: conflict.task.title, emphasis: true },
      {
        text: `${due} has nowhere to go and there is nothing it can bump. Open up a window in the week template, or push its due date.`,
      },
    ];
  }

  const bumped = conflict.wouldBumpPlacement;

  return [
    { text: conflict.task.title, emphasis: true },
    { text: `${due} has nowhere to go. Placing it means bumping ` },
    { text: conflict.wouldBump.title, emphasis: true },
    {
      text: ` off ${dayLabel(bumped.dayIndex)} ${formatClock(bumped.start)} and back to the backlog.`,
    },
  ];
}

/** `Tue`, `Thu` — sentence case, because these sit inside prose. */
function dayLabel(dayIndex: number): string {
  const label = WEEKDAY_LABELS[dayIndex] ?? "???";
  return label.charAt(0) + label.slice(1).toLowerCase();
}

/** Minutes a task will occupy, for callers outside the engine. */
export function taskDurationMinutes(task: Task): number {
  return blockMinutes(task.category) * task.estimatedBlocks;
}

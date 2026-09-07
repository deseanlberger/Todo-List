"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/domain/categories";
import { formatDueShort } from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";
import { Dot, Stars, categoryColor } from "./ui";

/** `2 blocks`, or `Handoff` for a delegate item. */
export function blockCountLabel(task: Task): string {
  if (task.category === "delegate") return "Handoff";
  return `${task.estimatedBlocks} block${task.estimatedBlocks === 1 ? "" : "s"}`;
}

function sentenceCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/**
 * A task row, shaped like a Reminders row: a coloured dot for the category,
 * the title, and a quieter second line underneath.
 */
export function TaskRow({
  task,
  timeZone,
  urgent,
  onRate,
  showCategory = true,
}: {
  task: Task;
  timeZone: string;
  urgent: boolean;
  onRate: (value: number) => void;
  /** Hidden when the group header already says it. */
  showCategory?: boolean;
}) {
  const done = task.status === "done";

  const meta: { text: string; color?: string }[] = [];
  if (showCategory) {
    meta.push({ text: sentenceCase(CATEGORIES[task.category].label) });
  }
  meta.push({ text: task.location === "gym" ? "Gym" : "Home" });
  if (task.dueDate) {
    meta.push({
      text: formatDueShort(task.dueDate, timeZone),
      color: urgent ? "var(--red)" : undefined,
    });
  }

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="ios-row ios-row-inset pressable"
      style={{ alignItems: "flex-start" }}
    >
      <span className="shrink-0 pt-[6px]">
        <Dot color={categoryColor(task.category)} />
      </span>

      <span className="min-w-0 flex-1">
        {/* Wrap rather than truncate: a clipped title is unreadable, and the
            star row leaves too little width to promise one line. */}
        <span
          className="t-body block"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          data-done={done}
        >
          <span
            style={{
              color: done ? "var(--label-3)" : "var(--label)",
              textDecoration: done ? "line-through" : undefined,
            }}
          >
            {task.title}
          </span>
        </span>
        <span className="t-footnote mt-0.5 block truncate" style={{ color: "var(--label-2)" }}>
          {meta.map((part, index) => (
            <span key={index} style={part.color ? { color: part.color } : undefined}>
              {index > 0 ? " · " : ""}
              {part.text}
            </span>
          ))}
        </span>
      </span>

      <span className="shrink-0 pt-[1px]" onClick={(event) => event.preventDefault()}>
        <Stars value={task.financialImpact} onChange={onRate} />
      </span>
    </Link>
  );
}

/** The compact variant used in the close-out swap picker. */
export function CompactTaskRow({
  task,
  right,
  onClick,
  selected = false,
}: {
  task: Task;
  right?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ios-row ios-row-inset pressable w-full"
      style={selected ? { background: "var(--fill-2)" } : undefined}
    >
      <Dot color={categoryColor(task.category)} />
      <span className="t-body min-w-0 flex-1 truncate">{task.title}</span>
      {right ? (
        <span className="t-subhead tnum shrink-0" style={{ color: "var(--label-2)" }}>
          {right}
        </span>
      ) : null}
      {selected ? (
        <span className="t-headline shrink-0" style={{ color: "var(--blue)" }}>
          ✓
        </span>
      ) : null}
    </button>
  );
}

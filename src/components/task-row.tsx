"use client";

import Link from "next/link";
import { CATEGORIES } from "@/lib/domain/categories";
import { formatDueLabel } from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";
import { Stars, labelColor, railColor } from "./ui";

export function blockCountLabel(task: Task): string {
  if (task.category === "delegate") return "HANDOFF";
  return `${task.estimatedBlocks} BLOCK${task.estimatedBlocks === 1 ? "" : "S"}`;
}

export function metaLine(task: Task, timeZone: string): string {
  const parts = [
    CATEGORIES[task.category].label,
    task.location === "gym" ? "GYM" : "HOME",
  ];
  if (task.dueDate) parts.push(`DUE ${formatDueLabel(task.dueDate, timeZone)}`);
  return parts.join(" · ");
}

/**
 * The All Tasks row. Category colour is confined to the 3px rail and the
 * category's own word in the meta line — never a fill, never the title.
 */
export function TaskRow({
  task,
  timeZone,
  urgent,
  onRate,
}: {
  task: Task;
  timeZone: string;
  urgent: boolean;
  onRate: (value: number) => void;
}) {
  const meta = metaLine(task, timeZone);
  const [category, location, due] = meta.split(" · ");

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="press mb-1.5 flex overflow-hidden rounded-[2px] border border-hairline bg-panel"
    >
      <span
        aria-hidden="true"
        className="w-[3px] shrink-0"
        style={{ background: railColor(task.category) }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-[11px] py-[9px]">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className="t-title min-w-0 flex-1"
            style={{
              textDecoration: task.status === "done" ? "line-through" : undefined,
              textDecorationColor: "var(--text-faded)",
              color: task.status === "done" ? "var(--text-faded)" : "var(--text)",
            }}
          >
            {task.title}
          </span>
          <span className="t-meta shrink-0 text-text-faded">{blockCountLabel(task)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="t-meta min-w-0 flex-1 truncate text-text-secondary">
            <span style={{ color: labelColor(task.category) }}>{category}</span>
            {location ? <> · {location}</> : null}
            {due ? (
              <>
                {" · "}
                {/* "Anything inside 48h reads urgent" — the sort explanation
                    line promises it, so the row has to deliver it. */}
                <span style={urgent ? { color: "var(--urgent)" } : undefined}>{due}</span>
              </>
            ) : null}
          </span>
          <span className="shrink-0" onClick={(event) => event.preventDefault()}>
            <Stars value={task.financialImpact} onChange={onRate} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/** The compact variant used on Week and inside the close-out swap picker. */
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
      className="press mb-1.5 flex w-full overflow-hidden rounded-[2px] border bg-panel"
      style={{
        borderColor: selected ? "var(--antique-gold)" : "var(--hairline)",
        background: selected ? "var(--card-navy)" : "var(--panel)",
      }}
    >
      <span
        aria-hidden="true"
        className="w-[3px] shrink-0"
        style={{ background: railColor(task.category) }}
      />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-[11px] py-[9px]">
        <span
          className="t-title min-w-0 flex-1 truncate"
          style={{ color: selected ? "#FFFFFF" : "var(--text)" }}
        >
          {task.title}
        </span>
        {right ? <span className="t-meta shrink-0 text-text-faded">{right}</span> : null}
      </span>
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Minus, Plus, X } from "lucide-react";
import { approveSchedule, discardSchedule } from "@/app/actions";
import { ActionBar, Content, IconButton } from "@/components/chrome";
import { Button, Dot, EmptyState, Group, categoryColor } from "@/components/ui";
import type { ScheduleDiff, SentencePart } from "@/lib/scheduler";
import type { TaskCategory } from "@/lib/domain/types";

export function ReviewScreen({
  diff,
  calendarKind,
}: {
  diff: ScheduleDiff | null;
  calendarKind: "google" | "stub";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!diff) {
    return (
      <>
        <Content className="pt-4">
          <EmptyState
            title="Nothing to review"
            detail="Run Schedule my week from the Week tab first."
          />
          <Button label="Back to the week" full onClick={() => router.push("/week")} />
        </Content>
      </>
    );
  }

  const approve = () => {
    setError(null);
    startTransition(async () => {
      try {
        await approveSchedule(diff.weekStart);
        router.push("/week");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The write failed.");
      }
    });
  };

  const discard = () => {
    startTransition(async () => {
      await discardSchedule(diff.weekStart);
      router.push("/week");
    });
  };

  return (
    <>
      <header className="flex shrink-0 items-start justify-between px-4 pt-2 pb-2">
        <div>
          <h1 className="t-large-title">
            {diff.totalChanges} {diff.totalChanges === 1 ? "change" : "changes"}
          </h1>
          <p className="t-subhead mt-0.5" style={{ color: "var(--label-2)" }}>
            Nothing is written yet
          </p>
        </div>
        <div className="-mr-2">
          <IconButton label="Close without writing" onClick={() => router.push("/week")}>
            <X size={24} strokeWidth={2.2} />
          </IconButton>
        </div>
      </header>

      <Content>
        {diff.conflicts.map((conflict) => (
          <div
            key={conflict.taskId}
            className="mb-6 rounded-[10px] p-4"
            style={{ background: "color-mix(in srgb, var(--orange) 12%, transparent)" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle size={18} strokeWidth={2} style={{ color: "var(--orange)" }} />
              <span className="t-subhead" style={{ color: "var(--orange)", fontWeight: 600 }}>
                Urgent item has nowhere to go
              </span>
            </div>
            <p className="t-callout" style={{ color: "var(--label)" }}>
              <Sentence parts={conflict.sentence} />
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                label="Open the task"
                kind="tinted"
                tint="var(--orange)"
                className="flex-1"
                onClick={() => router.push(`/tasks/${conflict.taskId}`)}
              />
              <Button label="Leave as is" kind="gray" className="flex-1" />
            </div>
          </div>
        ))}

        {diff.moves.length > 0 ? (
          <Group header={`Moves · ${diff.moves.length}`}>
            {diff.moves.map((move) => (
              <DiffRow
                key={move.taskId}
                icon={<ArrowRight size={16} strokeWidth={2.5} />}
                tint="var(--blue)"
                parts={move.sentence}
              />
            ))}
          </Group>
        ) : null}

        {diff.placements.length > 0 ? (
          <Group header={`New placements · ${diff.placements.length}`}>
            {diff.placements.map((placement) => (
              <DiffRow
                key={placement.taskId}
                icon={<Plus size={16} strokeWidth={2.5} />}
                tint="var(--green)"
                parts={placement.sentence}
              />
            ))}
          </Group>
        ) : null}

        {diff.removals.length > 0 ? (
          <Group header={`Clearing · ${diff.removals.length}`}>
            {diff.removals.map((removal) => (
              <DiffRow
                key={removal.taskId}
                icon={<Minus size={16} strokeWidth={2.5} />}
                tint="var(--red)"
                parts={removal.sentence}
              />
            ))}
          </Group>
        ) : null}

        {diff.didntFit.length > 0 ? (
          <Group header={`Didn't fit · ${diff.didntFit.length}`}>
            {diff.didntFit.map((task) => (
              <div key={task.taskId} className="ios-row ios-row-inset">
                <Dot color={categoryColor(task.category as TaskCategory)} />
                <span className="t-body min-w-0 flex-1 truncate">{task.title}</span>
                <span className="t-subhead tnum shrink-0" style={{ color: "var(--label-2)" }}>
                  {task.blocks} blk
                </span>
              </div>
            ))}
          </Group>
        ) : null}

        {diff.totalChanges === 0 && diff.conflicts.length === 0 ? (
          <EmptyState title="Already up to date" detail="The week matches the plan." />
        ) : null}

        {diff.recurringPlacedCount > 0 ? (
          <p className="t-footnote mb-3 px-4" style={{ color: "var(--label-2)" }}>
            {diff.recurringPlacedCount} recurring{" "}
            {diff.recurringPlacedCount === 1 ? "task is" : "tasks are"} placed first and never
            moved, so they aren&rsquo;t listed here.
          </p>
        ) : null}

        {calendarKind === "stub" ? (
          <p className="t-footnote px-4" style={{ color: "var(--label-2)" }}>
            No Google Calendar connected. Approving saves the week here only.
          </p>
        ) : null}

        {error ? (
          <p className="t-footnote mt-3 px-4" style={{ color: "var(--red)" }}>
            {error}
          </p>
        ) : null}
      </Content>

      <ActionBar>
        <div className="flex gap-2">
          <Button label="Discard" kind="gray" onClick={discard} disabled={pending} className="flex-1" />
          <Button
            label={
              pending
                ? "Writing…"
                : `Write ${diff.totalChanges} ${diff.totalChanges === 1 ? "change" : "changes"}`
            }
            kind="filled"
            onClick={approve}
            disabled={pending || diff.totalChanges === 0}
            style={{ flex: 1.6 }}
          />
        </div>
      </ActionBar>
    </>
  );
}

function DiffRow({
  icon,
  tint,
  parts,
}: {
  icon: React.ReactNode;
  tint: string;
  parts: SentencePart[];
}) {
  return (
    <div className="ios-row ios-row-inset" style={{ alignItems: "flex-start" }}>
      <span className="mt-[3px] shrink-0" style={{ color: tint }} aria-hidden="true">
        {icon}
      </span>
      <p className="t-subhead min-w-0 flex-1" style={{ color: "var(--label-2)" }}>
        <Sentence parts={parts} />
      </p>
    </div>
  );
}

/** Task names render in the primary label colour inside a quieter sentence. */
function Sentence({ parts }: { parts: SentencePart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.emphasis ? (
          <span key={index} style={{ color: "var(--label)", fontWeight: 600 }}>
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

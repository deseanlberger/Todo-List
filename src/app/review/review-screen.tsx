"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Minus, Plus, X } from "lucide-react";
import { approveSchedule, discardSchedule } from "@/app/actions";
import { ActionBar, Content, StatusBar } from "@/components/chrome";
import { Button, EmptyState, SectionLabel, railColor } from "@/components/ui";
import type { SentencePart } from "@/lib/scheduler";
import type { ScheduleDiff } from "@/lib/scheduler";

export function ReviewScreen({
  diff,
  clock,
  calendarKind,
}: {
  diff: ScheduleDiff | null;
  clock: string;
  calendarKind: "google" | "stub";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!diff) {
    return (
      <>
        <StatusBar clock={clock} />
        <Content>
          <div className="pt-16">
            <EmptyState>
              Nothing is waiting for approval. Run Schedule My Week from the Week
              screen first.
            </EmptyState>
            <div className="mt-3">
              <Button
                label="BACK TO THE WEEK"
                onClick={() => router.push("/week")}
                className="w-full"
              />
            </div>
          </div>
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
      <StatusBar clock={clock} />

      <header className="flex shrink-0 items-start justify-between px-[22px] pt-1.5 pb-3.5">
        <div>
          <div className="t-eyebrow mb-1.5" style={{ color: "var(--text-secondary)" }}>
            NOTHING WRITTEN YET
          </div>
          <h1 className="t-screen-title" style={{ fontSize: 30 }}>
            {diff.totalChanges} {diff.totalChanges === 1 ? "CHANGE" : "CHANGES"}
          </h1>
        </div>
        <button
          type="button"
          aria-label="Close without writing"
          onClick={() => router.push("/week")}
          className="press -mr-2 flex h-11 w-11 items-center justify-center text-text-secondary"
        >
          <X size={20} strokeWidth={1.5} />
        </button>
      </header>

      <Content>
        {diff.conflicts.map((conflict) => (
          <div
            key={conflict.taskId}
            className="mb-4 flex flex-col gap-[9px] rounded-[2px] p-3"
            style={{
              background: "var(--card-navy)",
              border: "1px solid var(--antique-gold)",
            }}
          >
            <div className="t-cat" style={{ color: "#C2453F", letterSpacing: "0.22em" }}>
              CONFLICT · {diff.conflicts.length} URGENT{" "}
              {diff.conflicts.length === 1 ? "ITEM HAS" : "ITEMS HAVE"} NOWHERE TO GO
            </div>
            <p className="t-body" style={{ fontSize: 15, lineHeight: 1.45, color: "#FFFFFF" }}>
              <Sentence parts={conflict.sentence} emphasisColor="var(--antique-gold)" />
            </p>
            <div className="flex gap-2">
              <Button
                tone="antique"
                label="BUMP IT"
                className="flex-1"
                onClick={() => router.push(`/tasks/${conflict.taskId}`)}
              />
              <Button
                tone="hairline"
                label="LEAVE AS IS"
                className="flex-1"
                style={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.25)" }}
              />
            </div>
          </div>
        ))}

        {diff.moves.length > 0 ? (
          <>
            <SectionLabel label={`MOVES · ${diff.moves.length}`} />
            {diff.moves.map((move) => (
              <DiffCard
                key={move.taskId}
                icon={<ArrowRight size={16} strokeWidth={1.5} />}
                iconColor="var(--gold-text)"
                parts={move.sentence}
              />
            ))}
          </>
        ) : null}

        {diff.placements.length > 0 ? (
          <>
            <SectionLabel label={`NEW PLACEMENTS · ${diff.placements.length}`} />
            {diff.placements.map((placement) => (
              <DiffCard
                key={placement.taskId}
                icon={<Plus size={16} strokeWidth={1.5} />}
                iconColor="var(--positive)"
                parts={placement.sentence}
              />
            ))}
          </>
        ) : null}

        {diff.removals.length > 0 ? (
          <>
            <SectionLabel label={`CLEARING · ${diff.removals.length}`} color="var(--urgent)" />
            {diff.removals.map((removal) => (
              <DiffCard
                key={removal.taskId}
                icon={<Minus size={16} strokeWidth={1.5} />}
                iconColor="var(--urgent)"
                parts={removal.sentence}
              />
            ))}
          </>
        ) : null}

        {diff.didntFit.length > 0 ? (
          <>
            <SectionLabel
              label={`DIDN'T FIT · ${diff.didntFit.length}`}
              color="var(--urgent)"
            />
            {diff.didntFit.map((task) => (
              <div
                key={task.taskId}
                className="mb-1.5 flex overflow-hidden rounded-[2px] border border-hairline bg-panel"
              >
                <span
                  aria-hidden="true"
                  className="w-[3px] shrink-0"
                  style={{ background: railColor(task.category as never) }}
                />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-[11px] py-[9px]">
                  <span className="t-title min-w-0 flex-1 truncate" style={{ fontSize: 14 }}>
                    {task.title}
                  </span>
                  <span className="t-meta shrink-0 text-text-faded">{task.blocks} BLK</span>
                </span>
              </div>
            ))}
          </>
        ) : null}

        {diff.totalChanges === 0 && diff.conflicts.length === 0 ? (
          <EmptyState>
            The week already matches the plan. Nothing to write.
          </EmptyState>
        ) : null}

        {diff.recurringPlacedCount > 0 ? (
          <p
            className="t-meta mt-4 border border-dashed border-hairline px-3 py-2.5 text-text-faded"
            style={{ lineHeight: 1.6 }}
          >
            {diff.recurringPlacedCount} RECURRING{" "}
            {diff.recurringPlacedCount === 1 ? "TASK" : "TASKS"} PLACED FIRST — NOT
            LISTED, NEVER MOVED.
          </p>
        ) : null}

        {calendarKind === "stub" ? (
          <p className="t-meta mt-3 text-text-faded" style={{ lineHeight: 1.6 }}>
            NO GOOGLE CALENDAR CONNECTED · APPROVING SAVES THE WEEK LOCALLY ONLY
          </p>
        ) : null}

        {error ? (
          <p className="t-meta mt-3" style={{ color: "var(--urgent)" }}>
            {error.toUpperCase()}
          </p>
        ) : null}

        <div className="h-4" />
      </Content>

      <ActionBar>
        <div className="flex gap-2">
          <Button
            tone="hairline"
            label="DISCARD"
            onClick={discard}
            disabled={pending}
            className="flex-1"
          />
          <button
            type="button"
            onClick={approve}
            disabled={pending || diff.totalChanges === 0}
            className="press press-gold t-button-sm rounded-[2px] py-[11px] text-center disabled:opacity-40"
            style={{ flex: 1.6, background: "var(--gold)", color: "#000" }}
          >
            {pending
              ? "WRITING…"
              : `WRITE ${diff.totalChanges} ${diff.totalChanges === 1 ? "CHANGE" : "CHANGES"}`}
          </button>
        </div>
      </ActionBar>
    </>
  );
}

function DiffCard({
  icon,
  iconColor,
  parts,
}: {
  icon: React.ReactNode;
  iconColor: string;
  parts: SentencePart[];
}) {
  return (
    <div className="mb-1.5 flex gap-[11px] rounded-[2px] border border-hairline bg-panel px-3 py-[11px]">
      <span className="mt-[2px] shrink-0" style={{ color: iconColor }} aria-hidden="true">
        {icon}
      </span>
      <p className="t-body min-w-0 flex-1 text-text-secondary">
        <Sentence parts={parts} />
      </p>
    </div>
  );
}

/** Task names render in the primary text colour inside a secondary sentence. */
function Sentence({
  parts,
  emphasisColor = "var(--text)",
}: {
  parts: SentencePart[];
  emphasisColor?: string;
}) {
  return (
    <>
      {parts.map((part, index) =>
        part.emphasis ? (
          <span key={index} style={{ color: emphasisColor }}>
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

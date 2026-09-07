"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import { closeOutBlock } from "@/app/actions";
import { CompactTaskRow } from "@/components/task-row";
import { Button, Group, Row } from "@/components/ui";
import { formatRange12 } from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";

type Choice = "completed" | "unfinished" | "swap";

const OPTIONS: { value: Choice; label: string; detail: string }[] = [
  {
    value: "completed",
    label: "Completed",
    detail: "Records the actual blocks used and feeds the estimator.",
  },
  {
    value: "unfinished",
    label: "Needs more time",
    detail: "Back to the backlog at a reduced estimate.",
  },
  {
    value: "swap",
    label: "Swap",
    detail: "Another task takes this block.",
  },
];

const CONFIRM: Record<Choice, string> = {
  completed: "Close block",
  unfinished: "Return to backlog",
  swap: "Confirm swap",
};

/** Three outcomes, no partial credit. */
export function CloseOutSheet({
  taskId,
  title,
  start,
  end,
  estimatedBlocks,
  candidates,
  onDismiss,
}: {
  taskId: string;
  title: string;
  start: number;
  end: number;
  estimatedBlocks: number;
  candidates: Task[];
  onDismiss: () => void;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [moreBlocks, setMoreBlocks] = useState(1);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (!choice) return;
    startTransition(async () => {
      await closeOutBlock({
        taskId,
        outcome: choice,
        moreBlocks,
        swapTaskId: swapId ?? undefined,
      });
      onDismiss();
      router.refresh();
    });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="fade-enter absolute inset-0"
        style={{ background: "var(--scrim)" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Close out ${title}`}
        className="sheet-enter no-scrollbar relative max-h-[88%] overflow-y-auto px-4 pb-8"
        style={{
          background: "var(--bg)",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      >
        <div className="sticky top-0 z-10 pt-2 pb-3" style={{ background: "var(--bg)" }}>
          <div
            className="mx-auto mb-4 h-[5px] w-9 rounded-full"
            style={{ background: "var(--label-4)" }}
            aria-hidden="true"
          />
          <h2 className="t-title3">{title}</h2>
          <p className="t-footnote mt-0.5" style={{ color: "var(--label-2)" }}>
            {formatRange12(start, end)} · estimated {estimatedBlocks}{" "}
            {estimatedBlocks === 1 ? "block" : "blocks"}
          </p>
        </div>

        <Group>
          {OPTIONS.map((option) => {
            const selected = choice === option.value;
            return (
              <Row key={option.value} onClick={() => setChoice(option.value)}>
                <span className="min-w-0 flex-1">
                  <span className="t-body block" style={{ fontWeight: selected ? 600 : 400 }}>
                    {option.label}
                  </span>
                  <span className="t-footnote block" style={{ color: "var(--label-2)" }}>
                    {option.detail}
                  </span>
                </span>
                {selected ? (
                  <Check size={20} strokeWidth={2.5} style={{ color: "var(--blue)" }} />
                ) : null}
              </Row>
            );
          })}
        </Group>

        {choice === "unfinished" ? (
          <Group
            header="How much more time?"
            footer="Returns to the backlog at the reduced estimate and gets re-placed on the next run."
          >
            <Row>
              <button
                type="button"
                aria-label="Less time"
                onClick={() => setMoreBlocks((value) => Math.max(1, value - 1))}
                className="pressable flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: "var(--fill)", color: "var(--blue)" }}
              >
                <Minus size={18} strokeWidth={2.5} />
              </button>
              <span className="flex-1 text-center">
                <span className="t-title2 tnum block">{moreBlocks}</span>
                <span className="t-footnote block" style={{ color: "var(--label-2)" }}>
                  {moreBlocks * 30} minutes
                </span>
              </span>
              <button
                type="button"
                aria-label="More time"
                onClick={() => setMoreBlocks((value) => Math.min(4, value + 1))}
                className="pressable flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: "var(--fill)", color: "var(--blue)" }}
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </Row>
          </Group>
        ) : null}

        {choice === "swap" ? (
          <Group
            header="What takes the block?"
            footer={`${title} goes back to the backlog untouched.`}
          >
            {candidates
              .filter((candidate) => candidate.id !== taskId)
              .slice(0, 12)
              .map((candidate) => (
                <CompactTaskRow
                  key={candidate.id}
                  task={candidate}
                  selected={swapId === candidate.id}
                  right={`${candidate.estimatedBlocks} blk`}
                  onClick={() => setSwapId(candidate.id)}
                />
              ))}
          </Group>
        ) : null}

        <Button
          label={pending ? "Saving…" : choice ? CONFIRM[choice] : "Pick an outcome"}
          kind="filled"
          full
          disabled={!choice || pending || (choice === "swap" && !swapId)}
          onClick={confirm}
        />
      </div>
    </div>
  );
}

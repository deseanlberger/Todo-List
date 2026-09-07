"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeOutBlock } from "@/app/actions";
import { CompactTaskRow } from "@/components/task-row";
import { PrimaryButton } from "@/components/ui";
import { formatRange } from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";

type Choice = "completed" | "unfinished" | "swap";

const OPTIONS: { value: Choice; label: string; sub: string; marker: string }[] = [
  {
    value: "completed",
    label: "COMPLETED",
    sub: "Records 1 block actual. Feeds the estimator.",
    marker: "EST 1 / ACT 1",
  },
  {
    value: "unfinished",
    label: "UNFINISHED",
    sub: "Back to backlog at a reduced estimate.",
    marker: "+ TIME",
  },
  {
    value: "swap",
    label: "SWAP",
    sub: "Another task takes this block.",
    marker: "PICK",
  },
];

const CONFIRM_LABEL: Record<Choice, string> = {
  completed: "CLOSE BLOCK",
  unfinished: "RETURN TO BACKLOG",
  swap: "CONFIRM SWAP",
};

/** §13. Three outcomes, no partial credit. */
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
        className="scrim absolute inset-0"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Close out ${title}`}
        className="sheet-enter no-scrollbar relative max-h-[88%] overflow-y-auto px-[22px] pt-5 pb-[26px]"
        style={{ background: "var(--panel)", borderTop: "2px solid var(--gold)" }}
      >
        <div className="mb-4">
          <div className="t-eyebrow mb-2 text-text-faded">
            {`BLOCK ENDING · ${formatRange(start, end)} · EST ${estimatedBlocks} ${
              estimatedBlocks === 1 ? "BLOCK" : "BLOCKS"
            }`}
          </div>
          <h2 className="t-sheet-title">{title}</h2>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          {OPTIONS.map((option) => {
            const selected = choice === option.value;
            return (
              <div key={option.value}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setChoice(option.value)}
                  className="press flex w-full items-center gap-3 rounded-[2px] px-[14px] py-[13px]"
                  style={{
                    background: selected ? "var(--card-navy)" : "var(--bg)",
                    border: `1px solid ${selected ? "var(--antique-gold)" : "var(--hairline)"}`,
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className="t-button-sm block"
                      style={{
                        fontSize: 12,
                        letterSpacing: "0.18em",
                        color: selected ? "#FFFFFF" : "var(--text-secondary)",
                      }}
                    >
                      {option.label}
                    </span>
                    <span
                      className="t-sub mt-1 block"
                      style={{ color: selected ? "rgba(255,255,255,0.65)" : "var(--text-secondary)" }}
                    >
                      {option.sub}
                    </span>
                  </span>
                  <span
                    className="t-meta shrink-0"
                    style={{ color: selected ? "var(--antique-gold)" : "var(--text-faded)" }}
                  >
                    {option.value === "completed"
                      ? `EST ${estimatedBlocks} / ACT ${estimatedBlocks}`
                      : option.marker}
                  </span>
                </button>

                {selected && option.value === "unfinished" ? (
                  <div
                    className="mt-2 rounded-[2px] p-[14px]"
                    style={{
                      background: "var(--card-navy)",
                      border: "1px solid var(--antique-gold)",
                    }}
                  >
                    <div className="t-eyebrow mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
                      HOW MUCH MORE TIME?
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        aria-label="Less time"
                        onClick={() => setMoreBlocks((value) => Math.max(1, value - 1))}
                        className="press flex h-10 w-10 items-center justify-center rounded-[2px]"
                        style={{ border: "1px solid rgba(255,255,255,0.25)", color: "#FFFFFF" }}
                      >
                        –
                      </button>
                      <div className="flex-1 text-center">
                        <div
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 30,
                            lineHeight: 1,
                            color: "#FFFFFF",
                          }}
                        >
                          {moreBlocks}
                        </div>
                        <div className="t-meta mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {moreBlocks * 30} MIN
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="More time"
                        onClick={() => setMoreBlocks((value) => Math.min(4, value + 1))}
                        className="press flex h-10 w-10 items-center justify-center rounded-[2px]"
                        style={{ border: "1px solid var(--gold)", color: "var(--gold)" }}
                      >
                        +
                      </button>
                    </div>
                    <p className="t-sub mt-3" style={{ color: "rgba(255,255,255,0.65)" }}>
                      Returns to the backlog at the reduced estimate and gets re-placed on
                      the next run.
                    </p>
                  </div>
                ) : null}

                {selected && option.value === "swap" ? (
                  <div
                    className="mt-2 rounded-[2px] p-[14px]"
                    style={{
                      background: "var(--card-navy)",
                      border: "1px solid var(--antique-gold)",
                    }}
                  >
                    <div className="t-eyebrow mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
                      WHAT TAKES THE BLOCK?
                    </div>
                    <div className="max-h-[180px] overflow-y-auto">
                      {candidates
                        .filter((candidate) => candidate.id !== taskId)
                        .map((candidate) => (
                          <CompactTaskRow
                            key={candidate.id}
                            task={candidate}
                            selected={swapId === candidate.id}
                            right={`${candidate.estimatedBlocks} BLK`}
                            onClick={() => setSwapId(candidate.id)}
                          />
                        ))}
                    </div>
                    <p className="t-sub mt-2" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {title} goes back to the backlog untouched.
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <PrimaryButton
          label={choice ? CONFIRM_LABEL[choice] : "PICK AN OUTCOME"}
          disabled={!choice || (choice === "swap" && !swapId)}
          pending={pending}
          onClick={confirm}
        />
      </div>
    </div>
  );
}

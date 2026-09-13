"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { placeTaskAt, slotsForDate, unplaceTask } from "@/app/actions";
import type { DaySlot } from "@/lib/day-slots";
import { taskMinutes } from "@/lib/domain/categories";
import { formatClock12, formatDayLong } from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";
import { Button, Group, Row } from "@/components/ui";

/**
 * "Put it where?" — the sheet behind tapping a task.
 *
 * Offers only time the week template says is the user's. An occupied slot is
 * still offered, flagged rather than blocked (§11): the app warns, the user
 * decides.
 */
export function PlaceSheet({
  task,
  initialDate,
  onClose,
}: {
  task: Task;
  /** `YYYY-MM-DD`. The day the sheet opens on. */
  initialDate: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<DaySlot[] | null>(null);
  const [confirming, setConfirming] = useState<DaySlot | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    setSlots(null);
    void slotsForDate(date).then((next) => {
      if (live) setSlots(next);
    });
    return () => {
      live = false;
    };
  }, [date]);

  // Delegate never reaches here: the callers send it to its own screen.
  const minutes = taskMinutes(task) ?? 0;

  const place = (slot: DaySlot) => {
    startTransition(async () => {
      await placeTaskAt({ taskId: task.id, date, start: slot.start });
      router.refresh();
      onClose();
    });
  };

  const choose = (slot: DaySlot) => {
    // Warn once before double-booking, then let it happen.
    if (slot.occupiedBy.length > 0 || slot.end - slot.start < minutes) {
      setConfirming(slot);
      return;
    }
    place(slot);
  };

  return (
    <div
      role="dialog"
      aria-label={`Place ${task.title}`}
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)" }}
      />

      <div
        className="sheet-enter relative max-h-[85dvh] overflow-y-auto rounded-t-[14px] px-4 pt-4 pb-8"
        style={{ background: "var(--bg)" }}
      >
        <p className="t-headline mb-0.5 text-center">{task.title}</p>
        <p className="t-footnote mb-4 text-center" style={{ color: "var(--label-2)" }}>
          Needs {minutes} min
        </p>

        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setDate(shiftDate(date, -1))}
            className="pressable flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: "var(--blue)" }}
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>

          <span className="t-subhead" style={{ fontWeight: 600 }}>
            {formatDayLong(date, weekdayOf(date))}
          </span>

          <button
            type="button"
            aria-label="Next day"
            onClick={() => setDate(shiftDate(date, 1))}
            className="pressable flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: "var(--blue)" }}
          >
            <ChevronRight size={20} strokeWidth={2.5} />
          </button>
        </div>

        {slots === null ? (
          <Group>
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="ios-row" style={{ height: 52 }}>
                <div className="shimmer h-[15px] flex-1 rounded-[4px]" />
              </div>
            ))}
          </Group>
        ) : slots.length === 0 ? (
          <Group footer="Set time blocks for this day under Settings, then it will show up here.">
            <Row>
              <span className="t-body flex-1" style={{ color: "var(--label-2)" }}>
                No time blocks on this day
              </span>
            </Row>
          </Group>
        ) : (
          <Group footer="An occupied slot is still offered. It gets flagged, not blocked.">
            {slots.map((slot, index) => {
              const busy = slot.occupiedBy.length > 0;
              const tight = slot.end - slot.start < minutes;

              return (
                <Row key={index} onClick={() => choose(slot)}>
                  <span className="min-w-0 flex-1">
                    <span className="t-body tnum block">
                      {formatClock12(slot.start, true)} – {formatClock12(slot.end, true)}
                    </span>
                    <span
                      className="t-footnote block truncate"
                      style={{ color: busy ? "var(--red)" : "var(--label-2)" }}
                    >
                      {busy ? `${slot.occupiedBy.join(", ")} is here` : slot.label}
                      {!busy && tight ? " · shorter than the task" : ""}
                    </span>
                  </span>
                  {busy || tight ? (
                    <AlertTriangle
                      size={16}
                      strokeWidth={2.2}
                      className="shrink-0"
                      style={{ color: "var(--red)" }}
                    />
                  ) : null}
                </Row>
              );
            })}
          </Group>
        )}

        {task.status === "scheduled" ? (
          <Button
            label="Take it off the calendar"
            kind="gray"
            full
            className="mb-2"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await unplaceTask(task.id);
                router.refresh();
                onClose();
              })
            }
          />
        ) : null}

        <a
          href={`/tasks/${task.id}`}
          className="pressable-solid t-body block rounded-[12px] py-[14px] text-center"
          style={{ color: "var(--blue)" }}
        >
          Edit task details
        </a>

        <Button label="Cancel" kind="plain" full onClick={onClose} disabled={pending} />
      </div>

      {confirming ? (
        <div className="absolute inset-0 z-10 flex items-end">
          <button
            type="button"
            aria-label="Keep looking"
            onClick={() => setConfirming(null)}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.35)" }}
          />
          <div
            className="sheet-enter relative w-full rounded-t-[14px] px-4 pt-5 pb-8"
            style={{ background: "var(--bg)" }}
          >
            <p className="t-headline mb-1 text-center">
              {confirming.occupiedBy.length > 0 ? "That slot is taken" : "That slot is short"}
            </p>
            <p
              className="t-footnote mb-4 text-center"
              style={{ color: "var(--label-2)" }}
            >
              {confirming.occupiedBy.length > 0
                ? `${confirming.occupiedBy.join(", ")} is already there. Both will sit on top of each other.`
                : `The slot is ${confirming.end - confirming.start} min and the task needs ${minutes}. It will run past the end.`}
            </p>
            <Button
              label={pending ? "Placing…" : "Put it there anyway"}
              kind="filled"
              tint="var(--red)"
              full
              className="mb-2"
              disabled={pending}
              onClick={() => place(confirming)}
            />
            <Button label="Keep looking" kind="plain" full onClick={() => setConfirming(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** 0 = Monday. */
function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return (Date.UTC(year, month - 1, day) / 86_400_000 + 3) % 7;
}

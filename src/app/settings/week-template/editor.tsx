"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { saveWeekTemplate } from "@/app/actions";
import { ActionBar, Content, StatusBar } from "@/components/chrome";
import { PrimaryButton, SegmentedToggle } from "@/components/ui";
import {
  WEEKDAY_LABELS,
  formatClock,
  formatDuration,
  formatOpenTime,
  parseClock,
} from "@/lib/domain/time";
import type { WindowAllowance } from "@/lib/domain/types";
import { templateCapacityBlocks, templateCapacityMinutes } from "@/lib/scheduler";

export interface EditorWindow {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  allowance: WindowAllowance;
  sortOrder: number;
}

/** Tapping the chip cycles: ANY → DEEP FOCUS → ADMIN ONLY → NO WORK. */
const ALLOWANCE_CYCLE: WindowAllowance[] = ["any", "deep_focus", "admin_only", "no_work"];

const ALLOWANCE_LABEL: Record<WindowAllowance, string> = {
  any: "ANY",
  deep_focus: "DEEP FOCUS",
  admin_only: "ADMIN ONLY",
  no_work: "NO WORK",
};

const ALLOWANCE_COLOR: Record<WindowAllowance, string> = {
  any: "var(--text-secondary)",
  deep_focus: "var(--gold-text)",
  admin_only: "var(--cat-low-priority-admin-label)",
  no_work: "var(--urgent)",
};

export function WeekTemplateEditor({
  clock,
  initialWindows,
  initialCap,
  initialReset,
  initialWeekendUncapped,
}: {
  clock: string;
  initialWindows: EditorWindow[];
  initialCap: number;
  initialReset: 10 | 15;
  initialWeekendUncapped: boolean;
}) {
  const router = useRouter();
  const [windows, setWindows] = useState<EditorWindow[]>(initialWindows);
  const [openDay, setOpenDay] = useState<number | null>(0);
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [reset, setReset] = useState<10 | 15>(initialReset);
  const [cap] = useState(initialCap);
  const [weekendUncapped] = useState(initialWeekendUncapped);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  // The one gold moment on the screen, because capacity is the number that
  // matters. Recomputed live as windows are edited.
  const capacity = useMemo(
    () => ({
      minutes: templateCapacityMinutes(asDomain(windows)),
      blocks: templateCapacityBlocks(asDomain(windows)),
    }),
    [windows],
  );

  const cycleAllowance = (id: string) => {
    setSaved(false);
    setWindows((current) =>
      current.map((window) =>
        window.id === id
          ? {
              ...window,
              allowance:
                ALLOWANCE_CYCLE[
                  (ALLOWANCE_CYCLE.indexOf(window.allowance) + 1) % ALLOWANCE_CYCLE.length
                ],
            }
          : window,
      ),
    );
  };

  const editTime = (id: string, field: "startTime" | "endTime", value: string) => {
    setSaved(false);
    setWindows((current) =>
      current.map((window) => (window.id === id ? { ...window, [field]: value } : window)),
    );
  };

  const removeWindow = (id: string) => {
    setSaved(false);
    setWindows((current) => current.filter((window) => window.id !== id));
  };

  const addWindow = (weekday: number) => {
    setSaved(false);
    setWindows((current) => [
      ...current,
      {
        id: `new-${weekday}-${Date.now()}`,
        weekday,
        startTime: "09:00",
        endTime: "10:00",
        allowance: "any",
        sortOrder: current.filter((w) => w.weekday === weekday).length,
      },
    ]);
  };

  const save = () => {
    startTransition(async () => {
      await saveWeekTemplate({
        windows: asDomain(windows).map((window, index) => ({ ...window, sortOrder: index })),
        deepFocusCap: cap,
        resetMinutes: reset,
        weekendUncapped,
      });
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <>
      <StatusBar clock={clock} />

      <header className="shrink-0 px-[22px] pt-1.5 pb-3.5">
        <button
          type="button"
          onClick={() => router.back()}
          className="press -ml-1 mb-1.5 flex items-center gap-1 text-text-secondary"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          <span className="t-eyebrow">SETTINGS</span>
        </button>
        <h1 className="t-screen-title" style={{ fontSize: 32 }}>
          WEEK TEMPLATE
        </h1>
        <p className="t-body mt-2.5 text-text-secondary" style={{ fontSize: 13, lineHeight: 1.45 }}>
          The scheduler only places work inside these windows. Everything outside them
          stays empty, whatever the calendar says.
        </p>
      </header>

      <div className="mx-[22px] mb-3 flex shrink-0 border border-hairline">
        <div className="flex-1 px-3 py-2.5">
          <div
            className="font-display text-[20px] leading-none"
            style={{ fontFamily: "var(--font-display)", color: "var(--gold-text)" }}
          >
            {formatDuration(capacity.minutes)}
          </div>
          <div className="t-eyebrow mt-1.5 text-text-faded">AVAILABLE TIME</div>
        </div>
        <div className="w-px bg-hairline" />
        <div className="flex-1 px-3 py-2.5">
          <div
            className="font-display text-[20px] leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {capacity.blocks}
          </div>
          <div className="t-eyebrow mt-1.5 text-text-faded">BEFORE RESETS</div>
        </div>
      </div>

      <Content>
        {WEEKDAY_LABELS.map((label, weekday) => {
          const dayWindows = windows
            .filter((window) => window.weekday === weekday)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          const isOpen = openDay === weekday;
          const openMinutes = dayWindows
            .filter((window) => window.allowance !== "no_work")
            .reduce(
              (total, window) =>
                total + (parseClock(window.endTime) - parseClock(window.startTime)),
              0,
            );

          return (
            <section key={label} className="border-t border-hairline first:border-t-0">
              <button
                type="button"
                onClick={() => setOpenDay(isOpen ? null : weekday)}
                aria-expanded={isOpen}
                className="press flex w-full items-center gap-3 py-[13px]"
              >
                <span
                  className="t-day"
                  style={{
                    letterSpacing: "0.04em",
                    color: isOpen ? "var(--text)" : "var(--text-faded)",
                  }}
                >
                  {label}
                </span>
                <span className="t-meta text-text-faded">
                  {dayWindows.length} {dayWindows.length === 1 ? "WINDOW" : "WINDOWS"}
                </span>
                <span className="t-meta flex-1 text-right text-text-secondary">
                  {formatOpenTime(openMinutes)}
                </span>
                {isOpen ? (
                  <ChevronDown size={14} strokeWidth={1.5} className="text-text-faded" />
                ) : (
                  <ChevronRight size={14} strokeWidth={1.5} className="text-text-faded" />
                )}
              </button>

              {isOpen ? (
                <div className="pb-3 pl-11">
                  {dayWindows.map((window) => {
                    const minutes =
                      window.allowance === "no_work"
                        ? 0
                        : parseClock(window.endTime) - parseClock(window.startTime);
                    const editing = editingTime === window.id;
                    return (
                      <div key={window.id}>
                        <div className="flex items-center gap-2.5 py-[7px]">
                          {/*
                            The design specifies the range as 92px of 11px
                            Roboto Mono, which is exactly wide enough to read
                            "05:30 – 08:00" and far too narrow for a native
                            time input. So the range stays type, and tapping
                            it opens a real picker on the row below.
                          */}
                          <button
                            type="button"
                            onClick={() => setEditingTime(editing ? null : window.id)}
                            aria-expanded={editing}
                            aria-label={`Edit the ${window.startTime} to ${window.endTime} window`}
                            className="press t-meta-11 w-[92px] shrink-0 text-left"
                            style={{ color: editing ? "var(--gold-text)" : "var(--text)" }}
                          >
                            {window.startTime} – {window.endTime}
                          </button>

                          <button
                            type="button"
                            onClick={() => cycleAllowance(window.id)}
                            className="press t-cat shrink-0 rounded-[2px] px-[9px] py-[5px]"
                            style={{
                              border: `1px solid ${ALLOWANCE_COLOR[window.allowance]}`,
                              color: ALLOWANCE_COLOR[window.allowance],
                              letterSpacing: "0.16em",
                            }}
                          >
                            {ALLOWANCE_LABEL[window.allowance]}
                          </button>

                          <span className="t-meta flex-1 text-right text-text-faded">
                            {minutes === 0 ? "—" : formatDuration(minutes)}
                          </span>

                          <button
                            type="button"
                            aria-label="Delete this window"
                            onClick={() => removeWindow(window.id)}
                            className="press flex h-11 w-6 items-center justify-center text-text-faded"
                          >
                            <Trash2 size={14} strokeWidth={1.5} />
                          </button>
                        </div>

                        {editing ? (
                          <div className="mb-2 flex items-center gap-2 pb-1">
                            <input
                              type="time"
                              aria-label="Window start"
                              value={window.startTime}
                              onChange={(event) =>
                                editTime(window.id, "startTime", event.target.value)
                              }
                              className="t-meta-11 flex-1 rounded-[2px] border border-hairline bg-panel px-2 py-[7px] text-text outline-none"
                            />
                            <span className="t-meta-11 text-text-faded">–</span>
                            <input
                              type="time"
                              aria-label="Window end"
                              value={window.endTime}
                              onChange={(event) =>
                                editTime(window.id, "endTime", event.target.value)
                              }
                              className="t-meta-11 flex-1 rounded-[2px] border border-hairline bg-panel px-2 py-[7px] text-text outline-none"
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => addWindow(weekday)}
                    className="press flex items-center gap-2 py-[7px]"
                    style={{ color: "var(--gold-text)" }}
                  >
                    <Plus size={14} strokeWidth={1.5} />
                    <span className="t-cat" style={{ letterSpacing: "0.16em" }}>
                      ADD WINDOW
                    </span>
                  </button>
                </div>
              ) : null}
            </section>
          );
        })}

        <div className="mt-2 flex items-center justify-between border-t border-hairline py-[13px]">
          <span className="t-section text-text-faded">DEEP FOCUS CAP</span>
          <span className="t-meta text-text-secondary">
            {cap} PER WEEKDAY · WEEKEND {weekendUncapped ? "UNCAPPED" : `CAPPED AT ${cap}`}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-hairline py-[13px]">
          <span className="t-section text-text-faded">RESET LENGTH</span>
          <SegmentedToggle
            ariaLabel="Reset length"
            value={String(reset)}
            options={[
              { value: "10", label: "10 MIN" },
              { value: "15", label: "15 MIN" },
            ]}
            onChange={(value) => {
              setSaved(false);
              setReset(Number(value) as 10 | 15);
            }}
          />
        </div>
        <div className="h-3" />
      </Content>

      <ActionBar>
        <p className="t-meta mb-2.5 text-text-faded">
          CHANGES APPLY ON THE NEXT SCHEDULE MY WEEK · PLACED BLOCKS ARE NOT MOVED
        </p>
        <PrimaryButton
          label={saved ? "SAVED" : "SAVE TEMPLATE"}
          onClick={save}
          pending={pending}
        />
      </ActionBar>
    </>
  );
}

function asDomain(windows: EditorWindow[]) {
  return windows
    .filter((window) => parseClock(window.endTime) > parseClock(window.startTime))
    .map((window) => ({
      weekday: window.weekday,
      startTime: formatClock(parseClock(window.startTime)),
      endTime: formatClock(parseClock(window.endTime)),
      allowance: window.allowance,
      sortOrder: window.sortOrder,
      id: window.id.startsWith("new-") ? undefined : window.id,
      userId: "",
    }));
}

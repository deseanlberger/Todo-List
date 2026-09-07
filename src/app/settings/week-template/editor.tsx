"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Minus, Plus, Trash2 } from "lucide-react";
import { saveWeekTemplate } from "@/app/actions";
import { ActionBar, Content } from "@/components/chrome";
import { NavBar } from "@/components/nav-bar";
import { Button, Group, Row, RowValue, Segmented, Switch } from "@/components/ui";
import { WEEKDAY_FULL, formatClock, parseClock } from "@/lib/domain/time";
import type { WindowAllowance } from "@/lib/domain/types";
import { templateCapacityBlocks, templateCapacityMinutes } from "@/lib/scheduler";

export interface EditorWindow {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  allowance: WindowAllowance;
  label: string | null;
  sortOrder: number;
}

/** Tapping the value cycles: Any → Deep focus → Admin only → Closed. */
const CYCLE: WindowAllowance[] = ["any", "deep_focus", "admin_only", "no_work"];

const ALLOWANCE_LABEL: Record<WindowAllowance, string> = {
  any: "Any",
  deep_focus: "Deep focus",
  admin_only: "Admin only",
  no_work: "Closed",
};

const ALLOWANCE_COLOR: Record<WindowAllowance, string> = {
  any: "var(--label-2)",
  deep_focus: "var(--cat-deep-focus)",
  admin_only: "var(--cat-low-priority-admin)",
  no_work: "var(--red)",
};

export function WeekTemplateEditor({
  initialWindows,
  initialCap,
  initialReset,
  initialWeekendUncapped,
}: {
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
  const [cap, setCap] = useState(initialCap);
  const [weekendUncapped, setWeekendUncapped] = useState(initialWeekendUncapped);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const capacity = useMemo(
    () => ({
      minutes: templateCapacityMinutes(asDomain(windows)),
      blocks: templateCapacityBlocks(asDomain(windows)),
    }),
    [windows],
  );

  const touch = () => setSaved(false);

  const cycleAllowance = (id: string) => {
    touch();
    setWindows((current) =>
      current.map((window) =>
        window.id === id
          ? { ...window, allowance: CYCLE[(CYCLE.indexOf(window.allowance) + 1) % CYCLE.length] }
          : window,
      ),
    );
  };

  const editLabel = (id: string, value: string) => {
    touch();
    setWindows((current) =>
      current.map((window) => (window.id === id ? { ...window, label: value } : window)),
    );
  };

  const editTime = (id: string, field: "startTime" | "endTime", value: string) => {
    touch();
    setWindows((current) =>
      current.map((window) => (window.id === id ? { ...window, [field]: value } : window)),
    );
  };

  const removeWindow = (id: string) => {
    touch();
    setWindows((current) => current.filter((window) => window.id !== id));
  };

  const addWindow = (weekday: number) => {
    touch();
    setWindows((current) => [
      ...current,
      {
        id: `new-${weekday}-${Date.now()}`,
        weekday,
        startTime: "09:00",
        endTime: "10:00",
        allowance: "any",
        label: null,
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
      <NavBar title="Time blocks" backLabel="Settings" />

      <Content className="pt-4">
        <Group footer="The scheduler only places work inside these blocks. Everything outside them stays empty, whatever the calendar says.">
          <Row>
            <span className="t-body flex-1">Available time</span>
            <span className="t-headline tnum" style={{ color: "var(--blue)" }}>
              {formatHours(capacity.minutes)}
            </span>
          </Row>
          <Row>
            <span className="t-body flex-1">Blocks before resets</span>
            <RowValue>{capacity.blocks}</RowValue>
          </Row>
        </Group>

        <Group footer="Tap a day to open it, then set the hours you are free. Tap a block to name it. Tap the pill to cycle what may land there.">
          {WEEKDAY_FULL.map((label, weekday) => {
          const dayWindows = windows
            .filter((window) => window.weekday === weekday)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          const isOpen = openDay === weekday;
          const openMinutes = dayWindows
            .filter((window) => window.allowance !== "no_work")
            .reduce(
              (total, w) => total + (parseClock(w.endTime) - parseClock(w.startTime)),
              0,
            );

          return (
            <div key={label}>
              <Row onClick={() => setOpenDay(isOpen ? null : weekday)}>
                <span className="t-body flex-1" style={{ fontWeight: isOpen ? 600 : 400 }}>
                  {label}
                </span>
                <RowValue>{openMinutes === 0 ? "Closed" : formatHours(openMinutes)}</RowValue>
                {isOpen ? (
                  <ChevronDown size={17} strokeWidth={2.5} style={{ color: "var(--label-3)" }} />
                ) : (
                  <ChevronRight size={17} strokeWidth={2.5} style={{ color: "var(--label-3)" }} />
                )}
              </Row>

              {isOpen
                ? dayWindows.map((window) => {
                    const editing = editingTime === window.id;

                    return (
                      <div key={window.id}>
                        <Row inset>
                          <button
                            type="button"
                            onClick={() => setEditingTime(editing ? null : window.id)}
                            aria-expanded={editing}
                            className="min-w-0 flex-1 text-left"
                            style={{ color: editing ? "var(--blue)" : "var(--label)" }}
                          >
                            {window.label?.trim() ? (
                              <>
                                <span className="t-body block truncate">{window.label}</span>
                                <span
                                  className="t-footnote tnum block"
                                  style={{ color: "var(--label-2)" }}
                                >
                                  {to12(window.startTime)} – {to12(window.endTime)}
                                </span>
                              </>
                            ) : (
                              <span className="t-body tnum block whitespace-nowrap">
                                {to12(window.startTime)} – {to12(window.endTime)}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => cycleAllowance(window.id)}
                            className="pressable-solid t-footnote shrink-0 truncate rounded-full px-2.5 py-1"
                            style={{
                              background: "var(--fill)",
                              color: ALLOWANCE_COLOR[window.allowance],
                              fontWeight: 500,
                            }}
                          >
                            {ALLOWANCE_LABEL[window.allowance]}
                          </button>

                          <button
                            type="button"
                            aria-label="Delete this time block"
                            onClick={() => removeWindow(window.id)}
                            className="pressable -mr-1 flex h-8 w-8 items-center justify-center rounded-full"
                            style={{ color: "var(--red)" }}
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        </Row>

                        {editing ? (
                          <>
                          <Row inset>
                            <input
                              aria-label="What this block is"
                              placeholder={
                                window.allowance === "no_work"
                                  ? "Closed for what? e.g. Coaching"
                                  : "Name this block (optional)"
                              }
                              value={window.label ?? ""}
                              onChange={(event) =>
                                editLabel(window.id, event.target.value)
                              }
                              className="t-body w-full rounded-[8px] px-2 py-1.5 outline-none"
                              style={{ background: "var(--fill)" }}
                            />
                          </Row>
                          <Row inset>
                            <input
                              type="time"
                              aria-label="Block start"
                              value={window.startTime}
                              onChange={(event) =>
                                editTime(window.id, "startTime", event.target.value)
                              }
                              className="t-body tnum flex-1 rounded-[8px] px-2 py-1.5 outline-none"
                              style={{ background: "var(--fill)" }}
                            />
                            <span style={{ color: "var(--label-3)" }}>–</span>
                            <input
                              type="time"
                              aria-label="Block end"
                              value={window.endTime}
                              onChange={(event) =>
                                editTime(window.id, "endTime", event.target.value)
                              }
                              className="t-body tnum flex-1 rounded-[8px] px-2 py-1.5 outline-none"
                              style={{ background: "var(--fill)" }}
                            />
                          </Row>
                          </>
                        ) : null}
                      </div>
                    );
                  })
                : null}

              {isOpen ? (
                <Row inset onClick={() => addWindow(weekday)}>
                  <Plus size={19} strokeWidth={2.2} style={{ color: "var(--blue)" }} />
                  <span className="t-body flex-1" style={{ color: "var(--blue)" }}>
                    Add a time block
                  </span>
                </Row>
              ) : null}
            </div>
          );
          })}
        </Group>

        <Group footer="At most this many 45-minute deep focus blocks land on a weekday. Changes apply on the next Schedule my week; blocks already placed are not moved.">
          <Row>
            <span className="t-body flex-1">Deep focus cap</span>
            <Stepper
              ariaLabel="Deep focus blocks per weekday"
              value={cap}
              min={1}
              max={8}
              onChange={(next) => {
                touch();
                setCap(next);
              }}
            />
          </Row>
          <Row>
            <span className="t-body flex-1">Weekend uncapped</span>
            <Switch
              ariaLabel="Weekend uncapped"
              checked={weekendUncapped}
              onChange={(next) => {
                touch();
                setWeekendUncapped(next);
              }}
            />
          </Row>
          <Row>
            <span className="t-body flex-1">Reset length</span>
            <Segmented
              ariaLabel="Reset length"
              className="w-[140px]"
              value={String(reset)}
              options={[
                { value: "10", label: "10 min" },
                { value: "15", label: "15 min" },
              ]}
              onChange={(value: string) => {
                touch();
                setReset(Number(value) as 10 | 15);
              }}
            />
          </Row>
        </Group>
      </Content>

      <ActionBar>
        <Button
          label={pending ? "Saving…" : saved ? "Saved" : "Save time blocks"}
          kind="filled"
          full
          disabled={pending}
          onClick={save}
        />
      </ActionBar>
    </>
  );
}

/** `7h 30m`, or `7h` on the hour. */
function formatHours(minutes: number): string {
  if (minutes <= 0) return "Closed";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** `5:30 AM` from a 24-hour `HH:MM`. */
function to12(clock: string): string {
  const [hour24, minute] = clock.split(":").map(Number);
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${hour24 < 12 ? "AM" : "PM"}`;
}

function asDomain(windows: EditorWindow[]) {
  return windows
    .filter((window) => parseClock(window.endTime) > parseClock(window.startTime))
    .map((window) => ({
      weekday: window.weekday,
      startTime: formatClock(parseClock(window.startTime)),
      endTime: formatClock(parseClock(window.endTime)),
      allowance: window.allowance,
      label: window.label?.trim() ? window.label.trim() : null,
      sortOrder: window.sortOrder,
      id: window.id.startsWith("new-") ? undefined : window.id,
      userId: "",
    }));
}

/** A UIKit-style −/+ stepper. Both halves keep a 44pt tap target. */
function Stepper({
  value,
  min,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="t-body tnum w-4 text-right">{value}</span>
      <div
        className="flex items-center overflow-hidden rounded-[8px]"
        role="group"
        aria-label={ariaLabel}
      >
        {([["Decrease", -1, Minus], ["Increase", 1, Plus]] as const).map(
          ([label, step, Icon]) => {
            const next = value + step;
            const disabled = next < min || next > max;
            return (
              <button
                key={label}
                type="button"
                aria-label={`${label} ${ariaLabel}`}
                disabled={disabled}
                onClick={() => onChange(next)}
                className="pressable-solid flex h-8 w-11 items-center justify-center"
                style={{
                  background: "var(--fill)",
                  color: disabled ? "var(--label-3)" : "var(--label)",
                  borderLeft: step === 1 ? "1px solid var(--bg)" : undefined,
                }}
              >
                <Icon size={17} strokeWidth={2.5} />
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}

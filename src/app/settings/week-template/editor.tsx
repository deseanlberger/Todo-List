"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { saveWeekTemplate } from "@/app/actions";
import { ActionBar, Content } from "@/components/chrome";
import { NavBar } from "@/components/nav-bar";
import { Button, Group, Row, RowValue, Segmented } from "@/components/ui";
import { WEEKDAY_FULL, formatClock, parseClock } from "@/lib/domain/time";
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
  const [cap] = useState(initialCap);
  const [weekendUncapped] = useState(initialWeekendUncapped);
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
      <NavBar title="Week template" backLabel="Settings" />

      <Content className="pt-4">
        <Group footer="The scheduler only places work inside these windows. Everything outside them stays empty, whatever the calendar says.">
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

        <Group footer="Tap a day to edit its windows. Tap a window's allowance to cycle what may land there.">
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
                            className="t-body tnum shrink-0 whitespace-nowrap text-left"
                            style={{ color: editing ? "var(--blue)" : "var(--label)" }}
                          >
                            {to12(window.startTime)} – {to12(window.endTime)}
                          </button>

                          <button
                            type="button"
                            onClick={() => cycleAllowance(window.id)}
                            className="pressable-solid t-footnote ml-auto shrink-0 truncate rounded-full px-2.5 py-1"
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
                            aria-label="Delete this window"
                            onClick={() => removeWindow(window.id)}
                            className="pressable -mr-1 flex h-8 w-8 items-center justify-center rounded-full"
                            style={{ color: "var(--red)" }}
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        </Row>

                        {editing ? (
                          <Row inset>
                            <input
                              type="time"
                              aria-label="Window start"
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
                              aria-label="Window end"
                              value={window.endTime}
                              onChange={(event) =>
                                editTime(window.id, "endTime", event.target.value)
                              }
                              className="t-body tnum flex-1 rounded-[8px] px-2 py-1.5 outline-none"
                              style={{ background: "var(--fill)" }}
                            />
                          </Row>
                        ) : null}
                      </div>
                    );
                  })
                : null}

              {isOpen ? (
                <Row inset onClick={() => addWindow(weekday)}>
                  <Plus size={19} strokeWidth={2.2} style={{ color: "var(--blue)" }} />
                  <span className="t-body flex-1" style={{ color: "var(--blue)" }}>
                    Add window
                  </span>
                </Row>
              ) : null}
            </div>
          );
          })}
        </Group>

        <Group footer="Changes apply on the next Schedule my week. Blocks already placed are not moved.">
          <Row>
            <span className="t-body flex-1">Deep focus cap</span>
            <RowValue>
              {cap} per weekday{weekendUncapped ? ", weekend uncapped" : ""}
            </RowValue>
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
          label={pending ? "Saving…" : saved ? "Saved" : "Save template"}
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
      sortOrder: window.sortOrder,
      id: window.id.startsWith("new-") ? undefined : window.id,
      userId: "",
    }));
}

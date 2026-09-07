"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Settings } from "lucide-react";
import { scheduleMyWeek } from "@/app/actions";
import { ActionBar, Content, Header, IconButton, TabBar } from "@/components/chrome";
import { Button, Dot, EmptyState, Group, Segmented, categoryColor } from "@/components/ui";
import {
  WEEKDAY_FULL,
  WEEKDAY_SHORT,
  formatClock12,
  formatDayShort,
} from "@/lib/domain/time";
import {
  DAY_SPAN_MINUTES,
  DAY_START_MINUTES,
  type WeekDay,
  type WeekView,
} from "@/lib/view-types";

type Mode = "load" | "grid";

export function WeekScreen({ view }: { view: WeekView }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("load");
  const [selected, setSelected] = useState(view.todayIndex ?? 0);
  const [pending, startTransition] = useTransition();

  const day = view.days[selected];

  const run = () => {
    startTransition(async () => {
      await scheduleMyWeek(view.weekStart);
      router.push("/review");
    });
  };

  const capLabel = (target: WeekDay) => {
    const weekend = target.dayIndex >= 5;
    if (weekend && view.weekendUncapped) return `${target.deepFocusBlocks} focus`;
    return `${target.deepFocusBlocks}/${view.deepFocusCap} focus`;
  };

  return (
    <>
      <Header
        title="Week"
        subtitle={`Week of ${formatDayShort(view.weekStart)}${
          view.todayIndex === null ? " · next week" : ""
        }`}
        trailing={
          <IconButton label="Settings" href="/settings" tint="var(--label-2)">
            <Settings size={22} strokeWidth={2} />
          </IconButton>
        }
      />

      <div className="shrink-0 px-4 pb-3">
        <Segmented
          ariaLabel="Week view"
          options={[
            { value: "load" as Mode, label: "Load" },
            { value: "grid" as Mode, label: "Grid" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      <Content>
        {mode === "grid" ? <WeekGrid view={view} /> : null}

        {mode === "load" ? (
          <Group header="Committed time by day">
            {view.days.map((entry) => {
              const active = entry.dayIndex === selected;
              return (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => setSelected(entry.dayIndex)}
                  aria-pressed={active}
                  className="ios-row pressable w-full"
                  style={
                    active
                      ? { background: "color-mix(in srgb, var(--blue) 8%, transparent)" }
                      : undefined
                  }
                >
                  <span
                    className="t-subhead w-9 shrink-0"
                    style={{
                      fontWeight: active || entry.isToday ? 600 : 400,
                      color: entry.isToday ? "var(--blue)" : "var(--label)",
                    }}
                  >
                    {WEEKDAY_SHORT[entry.dayIndex]}
                  </span>
                  <LoadMeter day={entry} />
                  <span
                    className="t-caption tnum w-[60px] shrink-0 text-right"
                    style={{ color: "var(--label-2)" }}
                  >
                    {capLabel(entry)}
                  </span>
                  <ChevronRight
                    size={17}
                    strokeWidth={2.5}
                    className="-mr-1 shrink-0"
                    style={{ color: "var(--label-3)" }}
                  />
                </button>
              );
            })}
          </Group>
        ) : null}

        {mode === "load" && day ? (
          <Group
            header={`${WEEKDAY_FULL[day.dayIndex]} · ${day.blockCount} ${
              day.blockCount === 1 ? "block" : "blocks"
            }, ${day.resetCount} ${day.resetCount === 1 ? "reset" : "resets"}`}
          >
            {day.entries.filter((entry) => !entry.isReset).length === 0 ? (
              <div className="ios-row">
                <span className="t-body" style={{ color: "var(--label-2)" }}>
                  Nothing on this day
                </span>
              </div>
            ) : null}
            {day.entries
              .filter((entry) => !entry.isReset)
              .map((entry, index) => (
                <div key={`${entry.title}-${index}`} className="ios-row ios-row-inset">
                  <span
                    className="t-footnote tnum w-[52px] shrink-0 text-right"
                    style={{ color: "var(--label-2)" }}
                  >
                    {formatClock12(entry.start)}
                  </span>
                  {entry.category ? (
                    <Dot color={categoryColor(entry.category)} />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-[10px] w-[10px] shrink-0 rounded-full"
                      style={{ border: "1.5px dashed var(--label-3)" }}
                    />
                  )}
                  <span
                    className="t-body min-w-0 flex-1 truncate"
                    style={{
                      color: entry.locked ? "var(--label-2)" : "var(--label)",
                      textDecoration: entry.done ? "line-through" : undefined,
                    }}
                  >
                    {entry.title}
                  </span>
                  {entry.urgent ? (
                    <span className="t-caption shrink-0" style={{ color: "var(--red)" }}>
                      Urgent
                    </span>
                  ) : null}
                </div>
              ))}
          </Group>
        ) : null}

        {view.didntFit.length > 0 ? (
          <Group
            header={`Didn't fit · ${view.didntFit.length}`}
            footer="Open one to re-rate it, move its due date, or shrink the estimate."
          >
            {view.didntFit.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="ios-row ios-row-inset pressable"
              >
                <Dot color={categoryColor(task.category)} />
                <span className="t-body min-w-0 flex-1 truncate">{task.title}</span>
                <span className="t-subhead tnum shrink-0" style={{ color: "var(--label-2)" }}>
                  {task.estimatedBlocks} blk
                </span>
                <ChevronRight
                  size={17}
                  strokeWidth={2.5}
                  className="-mr-1 shrink-0"
                  style={{ color: "var(--label-3)" }}
                />
              </Link>
            ))}
          </Group>
        ) : null}

        {view.days.every((entry) => entry.blockCount === 0) && view.didntFit.length === 0 ? (
          <EmptyState title="Nothing scheduled yet" detail="Tap Schedule my week below." />
        ) : null}
      </Content>

      <ActionBar>
        <Button
          label={
            pending
              ? "Working…"
              : view.hasPending
                ? "Review pending changes"
                : "Schedule my week"
          }
          kind="filled"
          full
          disabled={pending}
          onClick={view.hasPending ? () => router.push("/review") : run}
        />
      </ActionBar>

      <TabBar />
    </>
  );
}

/** A day's committed time: locked calendar time, then each block, then open. */
function LoadMeter({ day }: { day: WeekDay }) {
  const segments = day.entries
    .filter((entry) => !entry.isReset)
    .map((entry) => ({
      minutes: Math.max(0, entry.end - entry.start),
      color: entry.locked
        ? "var(--label-4)"
        : entry.category
          ? categoryColor(entry.category)
          : "var(--label-3)",
    }));

  const used = segments.reduce((total, segment) => total + segment.minutes, 0);
  const free = Math.max(0, DAY_SPAN_MINUTES - used);

  // One continuous track with the segments butted together. Rounding each
  // segment separately turns short blocks into dots and the bar stops
  // reading as a bar.
  return (
    <span
      className="flex h-[6px] flex-1 overflow-hidden rounded-full"
      style={{ background: "var(--fill)" }}
      aria-hidden="true"
    >
      {segments.map((segment, index) => (
        <span
          key={index}
          style={{
            background: segment.color,
            flexGrow: segment.minutes,
            flexBasis: 0,
            minWidth: 2,
          }}
        />
      ))}
      <span style={{ flexGrow: free, flexBasis: 0 }} />
    </span>
  );
}

/** A read-only overview of the whole week. Too dense to edit at this size. */
function WeekGrid({ view }: { view: WeekView }) {
  const HEIGHT = 380;
  const toOffset = (minutes: number) =>
    ((minutes - DAY_START_MINUTES) / DAY_SPAN_MINUTES) * HEIGHT;

  return (
    <Group header="The whole week">
      <div className="px-3 pt-3 pb-2">
        <div className="mb-1.5 flex">
          <span className="w-[26px] shrink-0" />
          {view.days.map((day) => (
            <span
              key={day.date}
              className="t-caption2 flex-1 text-center"
              style={{
                color: day.isToday ? "var(--blue)" : "var(--label-2)",
                fontWeight: day.isToday ? 600 : 400,
              }}
            >
              {WEEKDAY_SHORT[day.dayIndex].charAt(0)}
            </span>
          ))}
        </div>

        <div className="flex">
          <div className="relative w-[26px] shrink-0" style={{ height: HEIGHT }} aria-hidden="true">
            {[6, 9, 12, 15, 18, 21].map((hour) => (
              <span
                key={hour}
                className="t-caption2 tnum absolute right-1.5"
                style={{ top: toOffset(hour * 60) - 5, color: "var(--label-3)" }}
              >
                {hour % 12 === 0 ? 12 : hour % 12}
              </span>
            ))}
          </div>

          <div
            className="relative flex flex-1 overflow-hidden rounded-[6px]"
            style={{
              height: HEIGHT,
              backgroundImage:
                "repeating-linear-gradient(180deg, transparent 0 62px, var(--separator) 62px 62.5px)",
            }}
          >
            {view.days.map((day) => (
              <div
                key={day.date}
                className="relative flex-1"
                style={{
                  background: day.isToday
                    ? "color-mix(in srgb, var(--blue) 6%, transparent)"
                    : undefined,
                }}
              >
                {day.entries
                  .filter((entry) => !entry.isReset)
                  .map((entry, index) => {
                    const top = toOffset(entry.start);
                    const height = Math.max(
                      5,
                      ((entry.end - entry.start) / DAY_SPAN_MINUTES) * HEIGHT,
                    );
                    if (top + height < 0 || top > HEIGHT) return null;
                    return (
                      <span
                        key={index}
                        className="absolute left-[2px] right-[2px] rounded-[3px]"
                        style={{
                          top: Math.max(0, top),
                          height,
                          background: entry.locked
                            ? "var(--label-4)"
                            : entry.category
                              ? categoryColor(entry.category)
                              : "var(--label-3)",
                          opacity: entry.locked ? 1 : 0.85,
                        }}
                        title={entry.title}
                      />
                    );
                  })}

                {day.isToday ? (
                  <span
                    className="absolute left-0 right-0"
                    style={{
                      top: toOffset(view.nowMinutes),
                      height: 1.5,
                      background: "var(--red)",
                    }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Group>
  );
}

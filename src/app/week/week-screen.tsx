"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { scheduleMyWeek } from "@/app/actions";
import { Content, Header, StatusBar, TabBar } from "@/components/chrome";
import { EmptyState, PrimaryButton, SectionLabel, railColor } from "@/components/ui";
import { formatClock, formatEyebrowDate } from "@/lib/domain/time";
import {
  DAY_SPAN_MINUTES,
  DAY_START_MINUTES,
  type WeekDay,
  type WeekView,
} from "@/lib/week-view";

type Mode = "rail" | "grid";

export function WeekScreen({ view, clock }: { view: WeekView; clock: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("rail");
  const [selected, setSelected] = useState(view.todayIndex ?? 0);
  const [pending, startTransition] = useTransition();

  const day = view.days[selected];

  const run = () => {
    startTransition(async () => {
      await scheduleMyWeek(view.weekStart);
      router.push("/review");
    });
  };

  const capReadout = (target: WeekDay) => {
    const weekend = target.dayIndex >= 5;
    if (weekend && view.weekendUncapped) {
      return `DF ${target.deepFocusBlocks} · UNCAPPED`;
    }
    return `DF ${target.deepFocusBlocks}/${view.deepFocusCap}`;
  };

  return (
    <>
      <StatusBar clock={clock} />
      <Header
        eyebrow={`WEEK OF ${formatEyebrowDate(view.weekStart, 0).split(" · ")[1]}`}
        title="THE WEEK"
        trailing={
          <div className="text-right">
            <div className="t-meta text-text-secondary">
              {view.todayIndex !== null
                ? capReadout(view.days[view.todayIndex]) + " TODAY"
                : "NOT THIS WEEK"}
            </div>
            <div className="t-eyebrow mt-1 text-text-faded">
              CAP ACTIVE MON–{view.weekendUncapped ? "FRI" : "SUN"}
            </div>
          </div>
        }
      />

      <div className="shrink-0 px-[22px] pb-3">
        <PrimaryButton
          label={
            view.hasPending
              ? "REVIEW THE PENDING CHANGES"
              : "SCHEDULE MY WEEK"
          }
          pending={pending}
          onClick={view.hasPending ? () => router.push("/review") : run}
        />
        <div className="mt-2 flex gap-1.5">
          {(["rail", "grid"] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className="press t-chip flex-1 rounded-[2px] py-[7px] text-center"
              style={
                mode === value
                  ? { border: "1px solid var(--hairline)", color: "var(--text)" }
                  : { border: "1px solid transparent", color: "var(--text-faded)" }
              }
            >
              {value === "rail" ? "LOAD" : "GRID"}
            </button>
          ))}
        </div>
      </div>

      <Content>
        {mode === "grid" ? <WeekGrid view={view} /> : null}

        {mode === "rail"
          ? view.days.map((entry) => {
              const active = entry.dayIndex === selected;
              return (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => setSelected(entry.dayIndex)}
                  aria-pressed={active}
                  className="press -mx-[22px] flex w-[calc(100%+44px)] items-center gap-3 border-t border-hairline px-[22px] py-[11px]"
                  style={
                    active
                      ? {
                          background: "var(--card-navy)",
                          borderTop: "1px solid var(--antique-gold)",
                          borderBottom: "1px solid var(--antique-gold)",
                        }
                      : undefined
                  }
                >
                  <span
                    className="t-day w-9 shrink-0"
                    style={{
                      fontSize: active ? 19 : 17,
                      color: active ? "#FFFFFF" : "var(--text-faded)",
                    }}
                  >
                    {entry.label}
                  </span>
                  <LoadMeter day={entry} height={active ? 14 : 12} />
                  <span
                    className="t-meta w-[70px] shrink-0 text-right"
                    style={{
                      color: active ? "var(--antique-gold)" : "var(--text-faded)",
                    }}
                  >
                    {capReadout(entry)}
                  </span>
                </button>
              );
            })
          : null}

        {mode === "rail" && day ? (
          <>
            <SectionLabel
              label={`${formatEyebrowDate(day.date, day.dayIndex)} — ${day.blockCount} ${
                day.blockCount === 1 ? "BLOCK" : "BLOCKS"
              } · ${day.resetCount} ${day.resetCount === 1 ? "RESET" : "RESETS"}`}
            />
            {day.entries.length === 0 ? (
              <EmptyState>Nothing on this day yet.</EmptyState>
            ) : null}
            {day.entries
              .filter((entry) => !entry.isReset)
              .map((entry, index) => (
                <div
                  key={`${entry.title}-${index}`}
                  className="mb-1.5 flex items-center gap-2.5 rounded-[2px] border px-[11px] py-[9px]"
                  style={{
                    background: entry.locked ? "var(--panel-inert)" : "var(--panel)",
                    borderColor: "var(--hairline)",
                    borderStyle: entry.locked ? "dashed" : "solid",
                  }}
                >
                  <span
                    className="t-meta w-[42px] shrink-0"
                    style={{
                      color: entry.locked ? "var(--text-faded)" : "var(--text-secondary)",
                    }}
                  >
                    {formatClock(entry.start)}
                  </span>
                  <span
                    className="t-title min-w-0 flex-1 truncate"
                    style={{
                      fontSize: 14,
                      color: entry.locked ? "var(--text-faded)" : "var(--text)",
                      textDecoration: entry.done ? "line-through" : undefined,
                      textDecorationColor: "var(--text-faded)",
                    }}
                  >
                    {entry.title}
                  </span>
                  <span
                    className="t-meta shrink-0"
                    style={{ color: tagColor(entry.locked, entry.urgent) }}
                  >
                    {entry.locked
                      ? "LOCKED"
                      : entry.urgent
                        ? "URGENT"
                        : entry.location === "gym"
                          ? "GYM"
                          : "HOME"}
                  </span>
                </div>
              ))}
          </>
        ) : null}

        {view.didntFit.length > 0 ? (
          <>
            <SectionLabel
              label={`DIDN'T FIT · ${view.didntFit.length}`}
              color="var(--urgent)"
              hint="OPEN TO RE-RATE OR RE-DATE"
            />
            {view.didntFit.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="press mb-1.5 flex overflow-hidden rounded-[2px] border border-hairline bg-panel"
              >
                <span
                  aria-hidden="true"
                  className="w-[3px] shrink-0"
                  style={{ background: railColor(task.category) }}
                />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-[11px] py-[9px]">
                  <span className="t-title min-w-0 flex-1 truncate" style={{ fontSize: 14 }}>
                    {task.title}
                  </span>
                  <span className="t-meta shrink-0 text-text-faded">
                    {task.estimatedBlocks} BLK
                  </span>
                </span>
              </Link>
            ))}
          </>
        ) : null}
        <div className="h-4" />
      </Content>

      <TabBar />
    </>
  );
}

function tagColor(locked: boolean, urgent: boolean): string {
  if (locked) return "var(--text-faded)";
  if (urgent) return "var(--urgent)";
  return "var(--text-faded)";
}

/**
 * A day's committed time as proportional segments: locked calendar time,
 * then each scheduled block in its category colour, then the open remainder.
 */
function LoadMeter({ day, height }: { day: WeekDay; height: number }) {
  const segments = day.entries
    .filter((entry) => !entry.isReset)
    .map((entry) => ({
      minutes: Math.max(0, entry.end - entry.start),
      color: entry.locked
        ? "var(--hairline-2)"
        : entry.category
          ? railColor(entry.category)
          : "var(--text-faded)",
    }));

  const used = segments.reduce((total, segment) => total + segment.minutes, 0);
  const free = Math.max(0, DAY_SPAN_MINUTES - used);

  return (
    <span className="flex flex-1 gap-[2px]" style={{ height }} aria-hidden="true">
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
      <span style={{ background: "var(--panel)", flexGrow: free, flexBasis: 0 }} />
    </span>
  );
}

/**
 * The 7-column read-only overview. Deliberately too dense to edit at 50px a
 * column — editing happens in the day view.
 */
function WeekGrid({ view }: { view: WeekView }) {
  const GRID_HEIGHT = 392;
  const toOffset = (minutes: number) =>
    ((minutes - DAY_START_MINUTES) / DAY_SPAN_MINUTES) * GRID_HEIGHT;

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex">
        <span className="w-[26px] shrink-0" />
        {view.days.map((day) => (
          <span
            key={day.date}
            className="t-tab flex-1 text-center"
            style={{ color: day.isToday ? "var(--gold-text)" : "var(--text-faded)" }}
          >
            {day.label.slice(0, 1)}
          </span>
        ))}
      </div>

      <div className="flex">
        <div
          className="relative w-[26px] shrink-0"
          style={{ height: GRID_HEIGHT }}
          aria-hidden="true"
        >
          {[6, 9, 12, 15, 18, 21].map((hour) => (
            <span
              key={hour}
              className="t-gutter absolute right-1.5 text-text-faded"
              style={{ top: toOffset(hour * 60) - 5, fontSize: 9 }}
            >
              {String(hour).padStart(2, "0")}
            </span>
          ))}
        </div>

        <div
          className="relative flex flex-1 overflow-hidden rounded-[2px] border border-hairline"
          style={{
            height: GRID_HEIGHT,
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent 0 64px, var(--grid-line) 64px 65px)",
          }}
        >
          {view.days.map((day) => (
            <div
              key={day.date}
              className="relative flex-1 border-l border-grid-line first:border-l-0"
              style={{ background: day.isToday ? "var(--today-wash)" : undefined }}
            >
              {day.entries
                .filter((entry) => !entry.isReset)
                .map((entry, index) => {
                  const top = toOffset(entry.start);
                  const height = Math.max(
                    6,
                    ((entry.end - entry.start) / DAY_SPAN_MINUTES) * GRID_HEIGHT,
                  );
                  if (top + height < 0 || top > GRID_HEIGHT) return null;
                  return (
                    <span
                      key={index}
                      className="absolute left-[2px] right-[2px] flex overflow-hidden"
                      style={{
                        top: Math.max(0, top),
                        height,
                        background: entry.locked ? "var(--panel-inert)" : "var(--panel)",
                        border: entry.locked
                          ? "1px dashed var(--hairline-2)"
                          : "1px solid var(--hairline)",
                      }}
                      title={entry.title}
                    >
                      {entry.category ? (
                        <span
                          className="w-[3px] shrink-0"
                          style={{ background: railColor(entry.category) }}
                        />
                      ) : null}
                    </span>
                  );
                })}

              {day.isToday ? (
                <span
                  className="absolute left-0 right-0 h-px"
                  style={{
                    top: toOffset(view.nowMinutes),
                    background: "var(--gold)",
                  }}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { scheduleMyWeek } from "@/app/actions";
import { ActionBar, Content, Header, TabBar } from "@/components/chrome";
import { QuickAddButton } from "@/components/quick-add";
import { Button, Dot, EmptyState, Group, categoryColor } from "@/components/ui";
import { CATEGORIES } from "@/lib/domain/categories";
import {
  WEEKDAY_FULL,
  formatClock12,
  formatDayLong,
  formatRange12,
} from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";
import type { TodayView, WeekEntry } from "@/lib/view-types";
import { CloseOutSheet } from "./close-out-sheet";

export function TodayScreen({
  view,
  resetMinutes,
  estimatedBlocks,
}: {
  view: TodayView;
  resetMinutes: number;
  estimatedBlocks: number;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = view.activeEntry;
  const rows = buildRows(view, resetMinutes);

  const placeIt = () => {
    startTransition(async () => {
      await scheduleMyWeek();
      router.push("/review");
    });
  };

  return (
    <>
      <Header
        title="Today"
        subtitle={formatDayLong(view.date, view.dayIndex)}
        trailing={
          <div className="flex items-end gap-1">
            <div className="pb-1 text-right">
              <div className="t-title2 tnum">{view.blocksLeft}</div>
              <div className="t-caption" style={{ color: "var(--label-2)" }}>
                {view.blocksLeft === 1 ? "block left" : "blocks left"}
              </div>
            </div>
            <div className="-mr-2">
              <QuickAddButton />
            </div>
          </div>
        }
      />

      <Content>
        {view.urgentUnplaced.length > 0 ? (
          <UrgentBanner
            task={view.urgentUnplaced[0]}
            extra={view.urgentUnplaced.length - 1}
            onPlace={placeIt}
            pending={pending}
          />
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            title="Nothing today"
            detail={
              view.nextUp
                ? `Next up: ${view.nextUp.title}, ${
                    WEEKDAY_FULL[view.nextUp.dayIndex]
                  } at ${formatClock12(view.nextUp.start, true)}.`
                : "Run Schedule my week from the Week tab."
            }
          />
        ) : (
          <Group>
            {rows.map((row, index) => {
              if (row.kind === "now") {
                return <NowMarker key={`now-${index}`} minutes={view.nowMinutes} />;
              }
              if (row.kind === "reset") {
                return <ResetRow key={`reset-${index}`} minutes={row.minutes} />;
              }
              return (
                <TimelineRow
                  key={`${row.entry.title}-${index}`}
                  entry={row.entry}
                  isActive={row.isActive}
                />
              );
            })}
          </Group>
        )}
      </Content>

      {active ? (
        <ActionBar>
          <p className="t-footnote mb-2 text-center" style={{ color: "var(--label-2)" }}>
            {view.activeIsLive ? "Closing" : "Just ended"} · {active.title} ·{" "}
            {formatRange12(active.start, active.end)}
          </p>
          <Button
            label="Close out this block"
            kind="filled"
            full
            onClick={() => setSheetOpen(true)}
          />
        </ActionBar>
      ) : null}

      <TabBar />

      {sheetOpen && active?.taskId ? (
        <CloseOutSheet
          taskId={active.taskId}
          title={active.title}
          start={active.start}
          end={active.end}
          estimatedBlocks={estimatedBlocks}
          candidates={view.swapCandidates}
          onDismiss={() => setSheetOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Only rendered for urgent tasks with nowhere on the calendar yet. */
function UrgentBanner({
  task,
  extra,
  onPlace,
  pending,
}: {
  task: Task;
  extra: number;
  onPlace: () => void;
  pending: boolean;
}) {
  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-[10px] px-4 py-3"
      style={{ background: "color-mix(in srgb, var(--red) 12%, transparent)" }}
    >
      <AlertCircle size={20} strokeWidth={2} style={{ color: "var(--red)" }} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="t-subhead block" style={{ color: "var(--red)", fontWeight: 600 }}>
          Urgent, not placed
        </span>
        <span className="t-subhead block truncate" style={{ color: "var(--label)" }}>
          {task.title}
          {extra > 0 ? <span style={{ color: "var(--label-2)" }}> +{extra} more</span> : null}
        </span>
      </span>
      <button
        type="button"
        onClick={onPlace}
        disabled={pending}
        className="pressable-solid t-subhead shrink-0 rounded-full px-3 py-1.5 disabled:opacity-40"
        style={{ background: "var(--red)", color: "#fff", fontWeight: 600 }}
      >
        {pending ? "…" : "Place"}
      </button>
    </div>
  );
}

function NowMarker({ minutes }: { minutes: number }) {
  return (
    <div className="ios-row" style={{ minHeight: 0, paddingTop: 6, paddingBottom: 6 }}>
      <span
        className="t-caption2 tnum w-[52px] shrink-0 text-right"
        style={{ color: "var(--red)", fontWeight: 600 }}
      >
        {formatClock12(minutes)}
      </span>
      <span className="flex flex-1 items-center gap-1.5">
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: "var(--red)" }}
        />
        <span className="h-[1.5px] flex-1" style={{ background: "var(--red)" }} />
      </span>
    </div>
  );
}

function ResetRow({ minutes }: { minutes: number }) {
  return (
    <div className="ios-row" style={{ minHeight: 0, paddingTop: 5, paddingBottom: 5 }}>
      <span className="w-[52px] shrink-0" />
      <span className="t-caption flex-1" style={{ color: "var(--label-3)" }}>
        {minutes} min reset
      </span>
    </div>
  );
}

function TimelineRow({ entry, isActive }: { entry: WeekEntry; isActive: boolean }) {
  const locked = entry.locked;

  const body = (
    <>
      <span
        className="t-footnote tnum w-[52px] shrink-0 pt-[2px] text-right"
        style={{ color: isActive ? "var(--blue)" : "var(--label-2)" }}
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

      <span className="min-w-0 flex-1">
        <span
          className="t-body block truncate"
          style={{
            color: locked ? "var(--label-2)" : "var(--label)",
            fontWeight: isActive ? 600 : 400,
            textDecoration: entry.done ? "line-through" : undefined,
          }}
        >
          {entry.title}
        </span>
        <span className="t-footnote block truncate" style={{ color: "var(--label-2)" }}>
          {locked
            ? `Calendar · ${formatRange12(entry.start, entry.end)}`
            : [
                entry.category ? sentence(CATEGORIES[entry.category].label) : null,
                formatRange12(entry.start, entry.end),
                entry.location === "gym" ? "Gym" : entry.location === "home" ? "Home" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </span>
      </span>

      {isActive ? (
        <span
          className="t-caption2 shrink-0 rounded-full px-2 py-[3px]"
          style={{ background: "var(--blue)", color: "#fff", fontWeight: 600 }}
        >
          Now
        </span>
      ) : null}
    </>
  );

  const style = isActive
    ? { background: "color-mix(in srgb, var(--blue) 8%, transparent)" }
    : undefined;

  if (locked || !entry.taskId) {
    return (
      <div className="ios-row ios-row-inset" style={style}>
        {body}
      </div>
    );
  }

  return (
    <Link href={`/tasks/${entry.taskId}`} className="ios-row ios-row-inset pressable" style={style}>
      {body}
    </Link>
  );
}

function sentence(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/* -------------------------------------------------------------------- rows */

type Row =
  | { kind: "entry"; entry: WeekEntry; isActive: boolean }
  | { kind: "reset"; minutes: number }
  | { kind: "now" };

/** Weave the now marker and the stored reset gaps into the timeline. */
function buildRows(view: TodayView, resetMinutes: number): Row[] {
  const rows: Row[] = [];
  let nowPlaced = false;

  for (const entry of [...view.entries].sort((a, b) => a.start - b.start)) {
    if (!nowPlaced && entry.start > view.nowMinutes) {
      rows.push({ kind: "now" });
      nowPlaced = true;
    }

    if (entry.isReset) {
      rows.push({ kind: "reset", minutes: entry.end - entry.start || resetMinutes });
      continue;
    }

    rows.push({
      kind: "entry",
      entry,
      isActive:
        view.activeEntry !== null &&
        entry.taskId === view.activeEntry.taskId &&
        entry.start === view.activeEntry.start,
    });
  }

  if (!nowPlaced && rows.length > 0) rows.push({ kind: "now" });

  return rows;
}

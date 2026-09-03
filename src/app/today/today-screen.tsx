"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { scheduleMyWeek } from "@/app/actions";
import { Content, Header, HeaderMetric, StatusBar, TabBar } from "@/components/chrome";
import { Button, EmptyState, railColor, labelColor, categoryLabel } from "@/components/ui";
import {
  formatClock,
  formatDuration,
  formatEyebrowDate,
  formatRange,
} from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";
import type { TodayView, WeekEntry } from "@/lib/view-types";
import { CloseOutSheet } from "./close-out-sheet";

export function TodayScreen({
  view,
  clock,
  resetMinutes,
  estimatedBlocks,
}: {
  view: TodayView;
  clock: string;
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
      <StatusBar clock={clock} />

      <Header
        eyebrow={formatEyebrowDate(view.date, view.dayIndex)}
        title="TODAY"
        large
        trailing={
          <HeaderMetric value={String(view.blocksLeft)} label="BLOCKS LEFT" />
        }
      />

      {view.urgentUnplaced.length > 0 ? (
        <UrgentStrip
          task={view.urgentUnplaced[0]}
          extra={view.urgentUnplaced.length - 1}
          onPlace={placeIt}
          pending={pending}
        />
      ) : null}

      <Content>
        {rows.length === 0 ? (
          <EmptyState>
            Nothing on the calendar today. Run Schedule My Week from the Week screen.
          </EmptyState>
        ) : null}

        {rows.map((row, index) => {
          if (row.kind === "now") {
            return (
              <div key={`now-${index}`} className="flex items-center gap-2 py-2">
                <span
                  className="t-cat shrink-0 px-[5px] py-[2px]"
                  style={{
                    background: "var(--gold)",
                    color: "#000",
                    borderRadius: 1,
                    letterSpacing: "0.2em",
                  }}
                >
                  NOW {formatClock(view.nowMinutes)}
                </span>
                <span
                  className="h-px flex-1"
                  style={{ background: "var(--antique-gold)" }}
                />
              </div>
            );
          }

          if (row.kind === "reset") {
            return (
              <div
                key={`reset-${index}`}
                className="flex h-[14px] items-center gap-2 pl-[46px]"
              >
                <span className="reset-rule h-px flex-1" aria-hidden="true" />
                <span
                  className="t-cat shrink-0 text-text-faded"
                  style={{ fontSize: 8, letterSpacing: "0.25em" }}
                >
                  RESET · {row.minutes}
                </span>
              </div>
            );
          }

          return (
            <TimelineRow
              key={`${row.entry.title}-${index}`}
              entry={row.entry}
              isActive={row.isActive}
            />
          );
        })}
        <div className="h-4" />
      </Content>

      {active ? (
        <div className="flex shrink-0 flex-col gap-[9px] border-t border-hairline px-[22px] py-3">
          <span className="t-cat text-text-faded" style={{ letterSpacing: "0.22em" }}>
            {view.activeIsLive ? "CLOSING" : "JUST ENDED"} · {active.title.toUpperCase()} ·{" "}
            {formatRange(active.start, active.end)}
          </span>
          <div className="flex gap-2">
            <Button
              tone="gold"
              label="COMPLETED"
              className="flex-1"
              onClick={() => setSheetOpen(true)}
            />
            <Button
              label="MORE TIME"
              className="flex-1"
              onClick={() => setSheetOpen(true)}
            />
            <Button label="SWAP" className="flex-1" onClick={() => setSheetOpen(true)} />
          </div>
        </div>
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

/** Only for urgent tasks that are not yet placed. Otherwise not rendered. */
function UrgentStrip({
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
    <div className="mx-[22px] mb-3.5 flex shrink-0 items-center gap-2.5 overflow-hidden rounded-[2px] border border-hairline bg-panel">
      <span
        aria-hidden="true"
        className="w-[3px] shrink-0 self-stretch"
        style={{ background: "#C2453F" }}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2.5 py-[9px] pr-3">
        <span
          className="t-cat shrink-0"
          style={{ color: "var(--urgent)", letterSpacing: "0.22em" }}
        >
          URGENT · UNPLACED
        </span>
        <span className="t-title min-w-0 flex-1 truncate" style={{ fontSize: 13 }}>
          {task.title}
          {extra > 0 ? (
            <span className="text-text-faded"> +{extra}</span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onPlace}
          disabled={pending}
          className="press t-cat shrink-0 disabled:opacity-40"
          style={{ color: "var(--gold-text)", letterSpacing: "0.16em" }}
        >
          {pending ? "…" : "PLACE IT"}
        </button>
      </div>
    </div>
  );
}

function TimelineRow({ entry, isActive }: { entry: WeekEntry; isActive: boolean }) {
  const minutes = entry.end - entry.start;

  const card = (
    <div
      className="min-w-0 flex-1 rounded-[2px] px-3 py-[9px]"
      style={{
        background: isActive
          ? "var(--card-navy)"
          : entry.locked
            ? "var(--panel-inert)"
            : "var(--panel)",
        border: entry.locked
          ? "1px dashed var(--hairline)"
          : `1px solid ${isActive ? "var(--antique-gold)" : "var(--hairline)"}`,
        borderLeft:
          !entry.locked && entry.category
            ? `3px solid ${railColor(entry.category)}`
            : undefined,
      }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span
          className="t-cat min-w-0 truncate"
          style={{
            color: entry.locked
              ? "var(--text-faded)"
              : entry.category
                ? labelColor(entry.category)
                : "var(--text-faded)",
          }}
        >
          {entry.locked
            ? "LOCKED · CALENDAR"
            : entry.category
              ? categoryLabel(entry.category)
              : "BLOCK"}
        </span>
        <span
          className="t-meta shrink-0"
          style={{ color: isActive ? "var(--antique-gold)" : "var(--text-faded)" }}
        >
          {isActive ? "ACTIVE" : formatDuration(minutes)}
        </span>
      </div>
      <div
        className="t-title"
        style={{
          fontSize: isActive ? 16 : 14,
          color: isActive ? "#FFFFFF" : entry.locked ? "var(--text-faded)" : "var(--text)",
          textDecoration: entry.done ? "line-through" : undefined,
          textDecorationColor: "var(--text-faded)",
        }}
      >
        {entry.title}
      </div>
      {!entry.locked ? (
        <div
          className="t-meta mt-1.5"
          style={{ color: isActive ? "rgba(255,255,255,0.6)" : "var(--text-secondary)" }}
        >
          {formatRange(entry.start, entry.end)}
          {entry.location ? ` · ${entry.location.toUpperCase()}` : ""}
          {entry.done ? " · DONE" : ""}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="mb-1.5 flex gap-2.5">
      <span
        className="t-gutter w-9 shrink-0 pt-[10px] text-right"
        style={{ color: isActive ? "var(--gold-text)" : "var(--text-faded)" }}
      >
        {formatClock(entry.start)}
      </span>
      {entry.locked || !entry.taskId ? (
        card
      ) : (
        <Link href={`/tasks/${entry.taskId}`} className="press flex min-w-0 flex-1">
          {card}
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- rows */

type Row =
  | { kind: "entry"; entry: WeekEntry; isActive: boolean }
  | { kind: "reset"; minutes: number }
  | { kind: "now" };

/**
 * Weave the now marker and the reset gaps into the timeline. Resets come from
 * the stored blocks, so they land exactly where the scheduler put them.
 */
function buildRows(view: TodayView, resetMinutes: number): Row[] {
  const rows: Row[] = [];
  let nowPlaced = false;

  const ordered = [...view.entries].sort((a, b) => a.start - b.start);

  for (const entry of ordered) {
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

  if (!nowPlaced && ordered.length > 0) rows.push({ kind: "now" });

  return rows;
}

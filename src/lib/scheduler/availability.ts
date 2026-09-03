import {
  addDays,
  isoDate,
  minutesOfDay,
  parseClock,
  zonedParts,
} from "@/lib/domain/time";
import type {
  AvailabilityOverride,
  AvailabilityWindow,
  CalendarEvent,
  WindowAllowance,
} from "@/lib/domain/types";

/** An allowance that can actually receive work. `no_work` is filtered out. */
export type OpenAllowance = Exclude<WindowAllowance, "no_work">;

/**
 * A run of free wall-clock minutes on one day of the target week, already
 * intersected with the calendar's walls. Minutes are since local midnight.
 */
export interface Slot {
  /** 0 = Monday of the target week. */
  dayIndex: number;
  /** `YYYY-MM-DD`. */
  date: string;
  start: number;
  end: number;
  allowance: OpenAllowance;
}

export interface Wall {
  dayIndex: number;
  date: string;
  start: number;
  end: number;
  /** Inferred from the event's location field and title. See `location.ts`. */
  atGym: boolean;
  summary: string;
}

interface Interval {
  start: number;
  end: number;
}

/** The smallest unit any category occupies. Shorter gaps stay empty (§2). */
export const MIN_USABLE_MINUTES = 30;

const DAY_END = 24 * 60;

export interface BuildSlotsInput {
  /** Monday of the target week, `YYYY-MM-DD`. */
  weekStart: string;
  windows: AvailabilityWindow[];
  overrides: AvailabilityOverride[];
  walls: Wall[];
  timeZone: string;
  /** Nothing is placed in the past. */
  now: Date;
}

/**
 * SCHEDULER_RULES §3 and §9.2: take the recurring template, apply the
 * one-off overrides for these seven dates, subtract every calendar wall, and
 * return what is left.
 */
export function buildOpenSlots(input: BuildSlotsInput): Slot[] {
  const { weekStart, windows, overrides, walls, timeZone, now } = input;
  const today = isoDate(now, timeZone);
  const nowMinutes = minutesOfDay(now, timeZone);
  const slots: Slot[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const date = addDays(weekStart, dayIndex);

    // A day already behind us contributes nothing.
    if (date < today) continue;

    const dayWindows = applyOverrides(
      templateWindowsFor(windows, dayIndex),
      overrides.filter((o) => o.onDate === date),
    );

    const dayWalls = walls.filter((w) => w.date === date);

    for (const window of dayWindows) {
      let free: Interval[] = [{ start: window.start, end: window.end }];

      for (const wall of dayWalls) {
        free = subtract(free, { start: wall.start, end: wall.end });
      }

      if (date === today) {
        free = subtract(free, { start: 0, end: nowMinutes });
      }

      for (const interval of free) {
        if (interval.end - interval.start < MIN_USABLE_MINUTES) continue;
        slots.push({
          dayIndex,
          date,
          start: interval.start,
          end: interval.end,
          allowance: window.allowance,
        });
      }
    }
  }

  return slots.sort((a, b) => a.dayIndex - b.dayIndex || a.start - b.start);
}

interface OpenWindow {
  start: number;
  end: number;
  allowance: OpenAllowance;
}

function templateWindowsFor(
  windows: AvailabilityWindow[],
  weekday: number,
): OpenWindow[] {
  return windows
    .filter((w) => w.weekday === weekday && w.allowance !== "no_work")
    .map((w) => ({
      start: parseClock(w.startTime),
      end: parseClock(w.endTime),
      allowance: w.allowance as OpenAllowance,
    }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Overrides are held apart from the recurring pattern precisely so one odd
 * week cannot corrupt it (§3). A whole-day override replaces the day; a
 * timed one is carved out of the template and, when it is not `no_work`,
 * added back under its own allowance.
 */
function applyOverrides(
  base: OpenWindow[],
  overrides: AvailabilityOverride[],
): OpenWindow[] {
  let result = base;

  for (const override of overrides) {
    const wholeDay = override.startTime === null && override.endTime === null;

    if (wholeDay) {
      result =
        override.allowance === "no_work"
          ? []
          : [{ start: 0, end: DAY_END, allowance: override.allowance }];
      continue;
    }

    const start = parseClock(override.startTime!);
    const end = parseClock(override.endTime!);

    const carved: OpenWindow[] = [];
    for (const window of result) {
      for (const piece of subtract([{ start: window.start, end: window.end }], {
        start,
        end,
      })) {
        carved.push({ ...piece, allowance: window.allowance });
      }
    }

    if (override.allowance !== "no_work") {
      carved.push({ start, end, allowance: override.allowance });
    }

    result = carved.sort((a, b) => a.start - b.start);
  }

  return result;
}

/** Remove `cut` from every interval in `intervals`. */
function subtract(intervals: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const interval of intervals) {
    if (cut.end <= interval.start || cut.start >= interval.end) {
      out.push(interval);
      continue;
    }
    if (cut.start > interval.start) {
      out.push({ start: interval.start, end: cut.start });
    }
    if (cut.end < interval.end) {
      out.push({ start: cut.end, end: interval.end });
    }
  }
  return out;
}

/**
 * Total non-`no_work` minutes in the recurring template. This is the
 * capacity readout on the Week Template screen — before reset gaps are
 * deducted, as §3 specifies.
 */
export function templateCapacityMinutes(windows: AvailabilityWindow[]): number {
  return windows
    .filter((w) => w.allowance !== "no_work")
    .reduce((total, w) => total + (parseClock(w.endTime) - parseClock(w.startTime)), 0);
}

/** Capacity as a rough block count: minutes ÷ 30, before resets. */
export function templateCapacityBlocks(windows: AvailabilityWindow[]): number {
  return Math.floor(templateCapacityMinutes(windows) / 30);
}

/** Turn Google Calendar events into walls in the scheduler's minute space. */
export function toWalls(
  events: CalendarEvent[],
  timeZone: string,
  atGym: (event: CalendarEvent) => boolean,
): Wall[] {
  const walls: Wall[] = [];

  for (const event of events) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const startParts = zonedParts(start, timeZone);
    const endParts = zonedParts(end, timeZone);

    let cursor = new Date(start);
    // An event crossing midnight becomes one wall per day it touches.
    while (true) {
      const date = isoDate(cursor, timeZone);
      const parts = zonedParts(cursor, timeZone);
      const isLastDay = date === isoDate(end, timeZone);
      const startMinutes =
        cursor.getTime() === start.getTime()
          ? startParts.hour * 60 + startParts.minute
          : 0;
      const endMinutes = isLastDay ? endParts.hour * 60 + endParts.minute : DAY_END;

      if (endMinutes > startMinutes) {
        walls.push({
          dayIndex: parts.weekday,
          date,
          start: startMinutes,
          end: endMinutes,
          atGym: atGym(event),
          summary: event.summary,
        });
      }

      if (isLastDay) break;
      cursor = new Date(cursor.getTime() + 86_400_000);
      // Guard against a malformed multi-week event.
      if (cursor.getTime() > end.getTime()) break;
    }
  }

  return walls;
}

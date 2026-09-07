import { DEFAULT_TIME_ZONE, addDays, zonedTimeToUtc, parseIsoDate } from "@/lib/domain/time";
import type {
  AvailabilityOverride,
  AvailabilityWindow,
  CalendarEvent,
  SchedulerSettings,
  ScheduledBlock,
  Task,
} from "@/lib/domain/types";
import { buildOpenSlots, toWalls, type Slot } from "./availability";
import { buildDiff, type ScheduleDiff } from "./diff";
import { eventIsAtGym } from "./location";
import { planWeek, type Layout, type Placement, type ResetGap } from "./place";

export * from "./availability";
export * from "./diff";
export * from "./location";
export * from "./place";

export interface ScheduleWeekInput {
  /** Monday of the target week, `YYYY-MM-DD`. */
  weekStart: string;
  tasks: Task[];
  windows: AvailabilityWindow[];
  overrides: AvailabilityOverride[];
  /**
   * Everything already on the Google Calendar for this week. Events written
   * by a previous run (`isOurs`) are the current layout; everything else is
   * an immovable wall.
   */
  events: CalendarEvent[];
  /** Blocks this app last wrote, as stored in `scheduled_blocks`. */
  currentBlocks: ScheduledBlock[];
  settings: SchedulerSettings;
  now: Date;
  timeZone?: string;
}

export interface ScheduleWeekResult {
  layout: Layout;
  diff: ScheduleDiff;
  /** The open runs the layout was placed into. Empty means no capacity. */
  slots: Slot[];
}

/**
 * The whole run, top to bottom: read the calendar, intersect it with the week
 * template, place the work, diff it against what is already out there.
 *
 * Pure. Nothing here talks to Google, Supabase, or the clock — the caller
 * supplies all three. Approving the returned diff is what writes.
 */
export function scheduleWeek(input: ScheduleWeekInput): ScheduleWeekResult {
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;

  // §9.1: every event that is not ours is a wall.
  const walls = toWalls(
    input.events.filter((event) => !event.isOurs),
    timeZone,
    eventIsAtGym,
  );

  const slots = buildOpenSlots({
    weekStart: input.weekStart,
    windows: input.windows,
    overrides: input.overrides,
    walls,
    timeZone,
    now: input.now,
  });

  const layout = planWeek({
    weekStart: input.weekStart,
    tasks: input.tasks,
    slots,
    walls,
    settings: input.settings,
    now: input.now,
    timeZone,
  });

  const diff = buildDiff({
    weekStart: input.weekStart,
    layout,
    currentBlocks: input.currentBlocks,
    tasksById: new Map(input.tasks.map((task) => [task.id, task])),
    timeZone,
    now: input.now,
  });

  return { layout, diff, slots };
}

/** Turn a placement back into real instants for the calendar write. */
export function placementToInstants(
  placement: Placement | ResetGap,
  timeZone: string = DEFAULT_TIME_ZONE,
): { start: Date; end: Date } {
  return {
    start: minutesToInstant(placement.date, placement.start, timeZone),
    end: minutesToInstant(placement.date, placement.end, timeZone),
  };
}

export function minutesToInstant(
  isoDay: string,
  minutes: number,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  // Minutes past midnight can exceed a day only through a bug upstream, but
  // roll the date rather than producing a 25:00 wall-clock time.
  const dayOffset = Math.floor(minutes / 1440);
  const withinDay = minutes - dayOffset * 1440;
  const { year, month, day } = parseIsoDate(dayOffset ? addDays(isoDay, dayOffset) : isoDay);
  return zonedTimeToUtc(
    year,
    month,
    day,
    Math.floor(withinDay / 60),
    withinDay % 60,
    timeZone,
  );
}

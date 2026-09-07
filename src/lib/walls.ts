import "server-only";
import { CALENDAR_TIME_ZONE, calendar } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { addDays } from "@/lib/domain/time";
import type { CalendarEvent, Commitment } from "@/lib/domain/types";
import { minutesToInstant } from "@/lib/scheduler";

/**
 * Everything the scheduler must treat as already spoken for, from both
 * sources: the connected calendar, and the recurring commitments the user
 * typed in himself (SCHEDULER_RULES §9.1 — every event is a wall).
 *
 * Commitments are expanded into the same `CalendarEvent` shape rather than
 * carried as a separate concept, so every reader — the scheduler, the week
 * grid, the month view — picks them up with no change of its own.
 */
export async function wallsForRange(
  fromDate: string,
  toDateExclusive: string,
): Promise<CalendarEvent[]> {
  const [events, commitments] = await Promise.all([
    calendar().listRange(fromDate, toDateExclusive, CALENDAR_TIME_ZONE),
    repository().listCommitments(),
  ]);

  return [...events, ...expand(commitments, fromDate, toDateExclusive)];
}

/** The week `[weekStart, weekStart + 7)`. */
export async function wallsForWeek(weekStart: string): Promise<CalendarEvent[]> {
  return wallsForRange(weekStart, addDays(weekStart, 7));
}

/**
 * One synthetic event per commitment per matching date in the range.
 *
 * The id is derived from the commitment and the date, so the same commitment
 * on the same day always produces the same id. That keeps a re-run of the
 * scheduler deterministic, which the empty-diff guarantee depends on.
 */
export function expand(
  commitments: Commitment[],
  fromDate: string,
  toDateExclusive: string,
  timeZone = CALENDAR_TIME_ZONE,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Guard against a malformed range rather than looping forever.
  for (
    let date = fromDate, guard = 0;
    date < toDateExclusive && guard < 400;
    date = addDays(date, 1), guard++
  ) {
    const weekday = weekdayOf(date);
    for (const commitment of commitments) {
      if (commitment.weekday !== weekday) continue;
      events.push({
        id: `commitment-${commitment.id}-${date}`,
        summary: commitment.title,
        start: minutesToInstant(date, clock(commitment.startTime), timeZone).toISOString(),
        end: minutesToInstant(date, clock(commitment.endTime), timeZone).toISOString(),
        location: null,
        isOurs: false,
        atGym: commitment.location === "gym",
      });
    }
  }

  return events;
}

/**
 * 0 = Monday, matching `Commitment.weekday`. Read off the date string itself
 * so no timezone is involved: a calendar date has no offset to get wrong.
 */
function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return (Date.UTC(year, month - 1, day) / 86_400_000 + 3) % 7;
}

function clock(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

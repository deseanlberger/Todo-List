import type { CalendarEvent, TaskLocation } from "@/lib/domain/types";
import type { Wall } from "./availability";

/**
 * How far either side of a gap we look for a gym commitment. If the user
 * coaches until 15:00 and again from 15:30, the half hour between is spent
 * at the gym, not at a desk at home.
 */
export const GYM_PROXIMITY_MINUTES = 45;

/**
 * Keywords that mark a calendar event as physically at the facility.
 * Deliberately a plain heuristic over the event's own text — Google Calendar
 * gives us nothing better, and the user can always correct a placement.
 */
const GYM_KEYWORDS = [
  "gym",
  "odyssey",
  "session",
  "coach",
  "coaching",
  "training",
  "lift",
  "team",
  "practice",
  "camp",
  "class",
  "tour",
  "thibodo",
];

export function eventIsAtGym(event: CalendarEvent): boolean {
  const haystack = `${event.summary} ${event.location ?? ""}`.toLowerCase();
  return GYM_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export type InferredLocation = TaskLocation | "unknown";

/**
 * SCHEDULER_RULES §6. Where is the user between `start` and `end`?
 *
 * Only a *positive* gym signal is returned. Absence of evidence is
 * `unknown`, not "home" — the rule forbids putting a Home task in a gap at
 * the gym, it does not claim to know where the user is the rest of the time.
 */
export function inferLocation(
  walls: Wall[],
  date: string,
  start: number,
  end: number,
): InferredLocation {
  const nearbyGym = walls.some(
    (wall) =>
      wall.date === date &&
      wall.atGym &&
      wall.start - GYM_PROXIMITY_MINUTES < end &&
      wall.end + GYM_PROXIMITY_MINUTES > start,
  );
  return nearbyGym ? "gym" : "unknown";
}

/** True when a task of `taskLocation` may legally occupy this slot. */
export function locationAllows(
  inferred: InferredLocation,
  taskLocation: TaskLocation,
): boolean {
  if (inferred === "gym") return taskLocation === "gym";
  return true;
}

/**
 * True when the placement is not merely legal but *good* — a Gym task landing
 * beside gym time. The diff says so out loud when this holds.
 */
export function locationIsFavourable(
  inferred: InferredLocation,
  taskLocation: TaskLocation,
): boolean {
  return inferred === "gym" && taskLocation === "gym";
}

/** The gym commitment that makes a placement favourable, for the diff copy. */
export function gymAnchor(
  walls: Wall[],
  date: string,
  start: number,
  end: number,
): Wall | null {
  const candidates = walls.filter(
    (wall) =>
      wall.date === date &&
      wall.atGym &&
      wall.start - GYM_PROXIMITY_MINUTES < end &&
      wall.end + GYM_PROXIMITY_MINUTES > start,
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.start - b.start)[0];
}

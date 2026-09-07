/**
 * Timezone-aware time helpers, no dependencies.
 *
 * The scheduler works in "local wall-clock minutes within a weekday" rather
 * than in absolute timestamps. That keeps placement logic free of DST and
 * offset arithmetic; conversion to real instants happens only at the edges,
 * here.
 */

export const DEFAULT_TIME_ZONE = "America/Los_Angeles";

/** 0 = Monday ... 6 = Sunday, matching `availability_windows.weekday`. */
export const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
export const WEEKDAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export const MONTH_LABELS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  /** 0 = Monday ... 6 = Sunday. */
  weekday: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = partsCache.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    partsCache.set(timeZone, cached);
  }
  return cached;
}

const SHORT_WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/** Break an instant into wall-clock parts in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  // Intl renders midnight as "24" in some engines; normalise it to 0.
  const hour = Number(get("hour")) % 24;

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    weekday: SHORT_WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

/**
 * The inverse: a wall-clock time in `timeZone` back to an instant.
 *
 * Fixed-point iteration on the offset. Two passes converge everywhere a
 * single DST transition applies; the third is belt and braces.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const rendered = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const drift = Date.UTC(year, month - 1, day, hour, minute) - rendered;
    if (drift === 0) break;
    guess += drift;
  }
  return new Date(guess);
}

/** `YYYY-MM-DD` for an instant, in `timeZone`. */
export function isoDate(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Parse `YYYY-MM-DD` into its numeric parts. No timezone involved. */
export function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

/** Minutes since local midnight, in `timeZone`. */
export function minutesOfDay(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** `HH:MM` or `HH:MM:SS` to minutes since midnight. */
export function parseClock(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

/** Minutes since midnight to `HH:MM`, 24-hour. */
export function formatClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** `11:45 – 12:15`, the en-dash range the design calls for. */
export function formatRange(startMinutes: number, endMinutes: number): string {
  return `${formatClock(startMinutes)} – ${formatClock(endMinutes)}`;
}

/** `30 MIN` / `1H 30M`, uppercase, for mono duration readouts. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} MIN`;
  if (rest === 0) return `${hours}H`;
  return `${hours}H ${rest}M`;
}

/** `7H 30M OPEN` — the week-template day row readout. */
export function formatOpenTime(minutes: number): string {
  if (minutes <= 0) return "CLOSED";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours}H OPEN`;
  if (hours === 0) return `${rest}M OPEN`;
  return `${hours}H ${rest}M OPEN`;
}

/** Monday of the week containing `date`, as `YYYY-MM-DD` in `timeZone`. */
export function weekOf(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const monday = addDaysToDateParts(p, -p.weekday);
  return `${monday.year}-${pad(monday.month)}-${pad(monday.day)}`;
}

/** Calendar-day arithmetic on `YYYY-MM-DD`, timezone-free. */
export function addDays(isoDay: string, days: number): string {
  const { year, month, day } = parseIsoDate(isoDay);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

function addDaysToDateParts(p: { year: number; month: number; day: number }, days: number) {
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Whole days between two `YYYY-MM-DD` values, b - a. */
export function daysBetween(a: string, b: string): number {
  const pa = parseIsoDate(a);
  const pb = parseIsoDate(b);
  const ms =
    Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day);
  return Math.round(ms / 86_400_000);
}

/** `THU · SEP 03` — the eyebrow format. */
export function formatEyebrowDate(isoDay: string, dayIndex: number): string {
  const { month, day } = parseIsoDate(isoDay);
  return `${WEEKDAY_LABELS[dayIndex]} · ${MONTH_LABELS[month - 1]} ${pad(day)}`;
}

/** `WED SEP 02` — the due-date form on task meta rows. */
export function formatDueLabel(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const p = zonedParts(date, timeZone);
  return `${WEEKDAY_LABELS[p.weekday]} ${MONTH_LABELS[p.month - 1]} ${pad(p.day)}`;
}

/** `Wednesday` — for the plain-English diff sentences. */
export function formatDueWeekday(iso: string, timeZone: string): string {
  return WEEKDAY_FULL[zonedParts(new Date(iso), timeZone).weekday];
}

/* ------------------------------------------------- sentence-case variants
 * The uppercase forms above still serve the Telegram replies, where the app
 * has no styling of its own. On screen everything is sentence case.
 */

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `Wed Sep 2` — the due date on a task row. */
export function formatDueShort(iso: string, timeZone: string): string {
  const p = zonedParts(new Date(iso), timeZone);
  return `${WEEKDAY_SHORT[p.weekday]} ${MONTH_SHORT[p.month - 1]} ${p.day}`;
}

/** `Thursday, September 3` — a screen subtitle. */
export function formatDayLong(isoDay: string, dayIndex: number): string {
  const { month, day } = parseIsoDate(isoDay);
  return `${WEEKDAY_FULL[dayIndex]}, ${MONTH_FULL[month - 1]} ${day}`;
}

/** `Sep 1` — compact, for a week label. */
export function formatDayShort(isoDay: string): string {
  const { month, day } = parseIsoDate(isoDay);
  return `${MONTH_SHORT[month - 1]} ${day}`;
}

/**
 * `9:41` — a 12-hour clock without the meridiem, for dense timeline gutters
 * where the am/pm is obvious from position.
 */
export function formatClock12(minutes: number, withMeridiem = false): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(m / 60);
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const body = `${hour}:${pad(m % 60)}`;
  return withMeridiem ? `${body} ${hour24 < 12 ? "AM" : "PM"}` : body;
}

/** `9:00 – 10:30 AM`, or `11:45 AM – 12:15 PM` when the halves differ. */
export function formatRange12(startMinutes: number, endMinutes: number): string {
  const startPm = Math.floor(startMinutes / 60) >= 12;
  const endPm = Math.floor(endMinutes / 60) >= 12;
  if (startPm === endPm) {
    return `${formatClock12(startMinutes)} – ${formatClock12(endMinutes, true)}`;
  }
  return `${formatClock12(startMinutes, true)} – ${formatClock12(endMinutes, true)}`;
}

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Day index (0 = Monday) of `isoDay` relative to the Monday `weekStart`. */
export function dayIndexInWeek(weekStart: string, isoDay: string): number {
  return daysBetween(weekStart, isoDay);
}

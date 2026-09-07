import { addDays, daysInMonth, pad, parseIsoDate } from "./time";

/**
 * Repeating tasks.
 *
 * A deliberately small subset of RFC 5545, stored in `tasks.recurrence_rule`
 * so the column keeps its documented meaning and a fuller library could read
 * it later:
 *
 *   FREQ=DAILY
 *   FREQ=WEEKLY;BYDAY=MO,WE,FR
 *   FREQ=MONTHLY;BYMONTHDAY=31
 *   FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=15
 *
 * Everything here works in calendar dates — `YYYY-MM-DD` — never instants.
 * "The 31st" means the 31st wherever you are standing; converting to UTC
 * first is how a monthly task ends up firing on the 30th.
 */

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Recurrence {
  frequency: Frequency;
  /** Weekly only. 0 = Monday. Empty means "the same weekday as the due date". */
  weekdays: number[];
  /** Monthly only. 1-31; 31 lands on the last day of a short month. */
  monthDay?: number;
  /** Yearly only. 1-12. */
  month?: number;
}

const DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
};

/* ------------------------------------------------------------ the string */

export function formatRule(recurrence: Recurrence): string {
  switch (recurrence.frequency) {
    case "daily":
      return "FREQ=DAILY";
    case "weekly":
      return recurrence.weekdays.length > 0
        ? `FREQ=WEEKLY;BYDAY=${[...recurrence.weekdays]
            .sort((a, b) => a - b)
            .map((day) => DAY_CODES[day])
            .join(",")}`
        : "FREQ=WEEKLY";
    case "monthly":
      return recurrence.monthDay
        ? `FREQ=MONTHLY;BYMONTHDAY=${recurrence.monthDay}`
        : "FREQ=MONTHLY";
    case "yearly":
      return recurrence.month && recurrence.monthDay
        ? `FREQ=YEARLY;BYMONTH=${recurrence.month};BYMONTHDAY=${recurrence.monthDay}`
        : "FREQ=YEARLY";
  }
}

/** Null for anything unparseable, so bad stored data degrades to "no repeat". */
export function parseRule(rule: string | null): Recurrence | null {
  if (!rule) return null;

  const parts = new Map<string, string>();
  for (const chunk of rule.split(";")) {
    const [key, value] = chunk.split("=");
    if (key && value) parts.set(key.trim().toUpperCase(), value.trim().toUpperCase());
  }

  const freq = parts.get("FREQ");
  const frequency = (
    { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" } as const
  )[freq as "DAILY"];
  if (!frequency) return null;

  const weekdays = (parts.get("BYDAY") ?? "")
    .split(",")
    .map((code) => DAY_CODES.indexOf(code.trim()))
    .filter((index) => index >= 0);

  const monthDay = clamp(Number(parts.get("BYMONTHDAY")), 1, 31);
  const month = clamp(Number(parts.get("BYMONTH")), 1, 12);

  return { frequency, weekdays, monthDay, month };
}

function clamp(value: number, min: number, max: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/* --------------------------------------------------------------- the date */

/**
 * The first date this rule lands on strictly after `after`.
 *
 * `after` and the result are both `YYYY-MM-DD`. Returns null when the rule
 * cannot be parsed, so a caller can leave the task alone rather than invent
 * a date for it.
 */
export function nextOccurrence(rule: string | null, after: string): string | null {
  const recurrence = parseRule(rule);
  if (!recurrence) return null;

  switch (recurrence.frequency) {
    case "daily":
      return addDays(after, 1);

    case "weekly": {
      // No days chosen means "same weekday as this one", which is a week on.
      if (recurrence.weekdays.length === 0) return addDays(after, 7);

      const wanted = new Set(recurrence.weekdays);
      for (let step = 1; step <= 7; step++) {
        const candidate = addDays(after, step);
        if (wanted.has(weekdayOf(candidate))) return candidate;
      }
      return addDays(after, 7);
    }

    case "monthly": {
      const { year, month, day } = parseIsoDate(after);
      const target = recurrence.monthDay ?? day;
      // Later this same month if the target has not passed yet, else next.
      const thisMonth = onDayOf(year, month, target);
      if (thisMonth > after) return thisMonth;
      const [nextYear, nextMonth] = month === 12 ? [year + 1, 1] : [year, month + 1];
      return onDayOf(nextYear, nextMonth, target);
    }

    case "yearly": {
      const { year, month, day } = parseIsoDate(after);
      const targetMonth = recurrence.month ?? month;
      const targetDay = recurrence.monthDay ?? day;
      const thisYear = onDayOf(year, targetMonth, targetDay);
      return thisYear > after ? thisYear : onDayOf(year + 1, targetMonth, targetDay);
    }
  }
}

/**
 * `year-month-day`, with the day pulled back to the last of the month when
 * that month is too short. Rent on the 31st is due on the 30th in September
 * and the 28th in February; skipping those months would be worse.
 */
function onDayOf(year: number, month: number, day: number): string {
  const last = daysInMonth(`${year}-${pad(month)}-01`);
  return `${year}-${pad(month)}-${pad(Math.min(day, last))}`;
}

/** 0 = Monday, read off the date itself so no timezone is involved. */
function weekdayOf(isoDay: string): number {
  const { year, month, day } = parseIsoDate(isoDay);
  return (Date.UTC(year, month - 1, day) / 86_400_000 + 3) % 7;
}

/** "Every week on Mon, Wed" — what the task detail screen shows. */
export function describeRule(rule: string | null): string | null {
  const recurrence = parseRule(rule);
  if (!recurrence) return null;

  if (recurrence.frequency === "weekly" && recurrence.weekdays.length > 0) {
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return `Every week on ${[...recurrence.weekdays]
      .sort((a, b) => a - b)
      .map((day) => names[day])
      .join(", ")}`;
  }

  if (recurrence.frequency === "monthly" && recurrence.monthDay) {
    return `Every month on the ${ordinal(recurrence.monthDay)}`;
  }

  return FREQUENCY_LABEL[recurrence.frequency];
}

function ordinal(value: number): string {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
}

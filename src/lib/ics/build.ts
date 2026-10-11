import { LIST_LABELS } from "@/lib/domain/categories";
import type { Task } from "@/lib/domain/types";

/**
 * Building an iCalendar feed of the week's scheduled work.
 *
 * Why a calendar feed rather than push notifications: iOS already has a
 * notification system for "a thing is starting", it is better than anything
 * this app could build, and it does not need a cron. Subscribe the phone
 * once and every block carries its own alert, offline, forever. The
 * alternative was a service worker, VAPID keys, a stored subscription and
 * something firing all day to send them — which the hosting plan would not
 * allow anyway.
 *
 * This produces RFC 5545 text. It is written by hand rather than with a
 * library because the subset needed is small and every line of it is
 * either required by the spec or doing something specific for Apple.
 *
 * It used to publish scheduled blocks. The scheduler is gone, so it
 * publishes what a task list actually has: things with a due date. A task
 * with no date is not a calendar entry and is left out rather than dumped
 * on an arbitrary day.
 */

/** How long a due task occupies on the calendar. It is a marker, not a plan. */
const EVENT_MINUTES = 30;

export interface IcsOptions {
  /** Minutes before the start to fire the alert. Zero means on the dot. */
  alarmMinutes: number;
  /** What the calendar is called in the phone's calendar list. */
  name: string;
  /** Used to build a stable UID domain. */
  host: string;
}

export function buildIcs(tasks: Task[], options: IcsOptions): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Odyssey//Scheduler//EN",
    "CALSCALE:GREGORIAN",
    // A subscribed calendar is read-only on the phone, which is what we
    // want: editing it there would be silently thrown away on next refresh.
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(options.name)}`,
    // Apple reads this as a refresh hint. It is a hint, not a promise —
    // iOS refreshes subscribed calendars when it feels like it.
    "X-PUBLISHED-TTL:PT30M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
  ];

  for (const task of tasks) {
    // No date, no calendar entry.
    if (!task.dueDate || Number.isNaN(Date.parse(task.dueDate))) continue;
    lines.push(...event(task, options));
  }

  lines.push("END:VCALENDAR");

  // RFC 5545 wants CRLF, and Apple is one of the stricter readers.
  return lines.flatMap(fold).join("\r\n") + "\r\n";
}

function event(task: Task, options: IcsOptions): string[] {
  const start = new Date(task.dueDate!);
  const end = new Date(start.getTime() + EVENT_MINUTES * 60_000);

  const lines = [
    "BEGIN:VEVENT",
    // Stable per task, so a refresh updates the entry rather than adding a
    // duplicate alongside it.
    `UID:${task.id}@${options.host}`,
    `DTSTAMP:${stamp(task.createdAt)}`,
    `DTSTART:${stamp(start.toISOString())}`,
    `DTEND:${stamp(end.toISOString())}`,
    `SUMMARY:${escape(task.title)}`,
  ];

  const detail = description(task);
  if (detail) lines.push(`DESCRIPTION:${escape(detail)}`);

  // Done work still has a due date. It belongs in the history the calendar
  // shows, but alerting about something already ticked off is noise, and
  // noise is how an alert stops being read.
  if (task.status !== "done") {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escape(task.title)}`,
      `TRIGGER:${trigger(options.alarmMinutes)}`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT");
  return lines;
}

function description(task: Task): string | null {
  const parts = [task.needsCategory ? "Needs a home" : LIST_LABELS[task.category]];
  if (task.notes) parts.push(task.notes);
  return parts.join("\n\n");
}

/** `-PT15M`, or `PT0S` for an alert on the dot. */
function trigger(minutes: number): string {
  if (minutes <= 0) return "PT0S";
  return `-PT${Math.round(minutes)}M`;
}

/** `20261011T170000Z`. Always UTC, which sidesteps shipping a VTIMEZONE. */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * RFC 5545 §3.3.11. Backslash, semicolon and comma are delimiters, and a
 * newline has to be written as the two characters \n — a real newline in a
 * value ends the property and corrupts everything after it.
 */
function escape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 §3.1: no line over 75 octets. Measured in OCTETS, not
 * characters, so the split counts UTF-8 bytes and never lands mid-character
 * — an emoji cut in half would make the whole feed unparseable.
 */
function fold(line: string): string[] {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return [line];

  const out: string[] = [];
  let start = 0;
  // 75 for the first line, then 74 plus the leading space on each
  // continuation.
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Walk back off a UTF-8 continuation byte (10xxxxxx).
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    const chunk = bytes.subarray(start, end).toString("utf8");
    out.push(out.length === 0 ? chunk : ` ${chunk}`);
    start = end;
    limit = 74;
  }

  return out;
}

import "server-only";
import { google } from "googleapis";
import { DEMO_CALENDAR } from "@/lib/data/seed";
import { DEFAULT_TIME_ZONE, addDays, isoDate, weekOf } from "@/lib/domain/time";
import { env, hasEnv } from "@/lib/env";
import type { CalendarEvent } from "@/lib/domain/types";
import { minutesToInstant } from "@/lib/scheduler";

export interface CalendarWrite {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
}

export interface CalendarAdapter {
  readonly kind: "google" | "stub";
  /** Read the week. Always called before anything is written (§ read first). */
  listWeek(weekStart: string, timeZone: string): Promise<CalendarEvent[]>;
  /** Read an arbitrary span of days, `[fromDate, toDate)`. */
  listRange(fromDate: string, toDate: string, timeZone: string): Promise<CalendarEvent[]>;
  /** Replace every event this app owns in the week with `events`. */
  writeWeek(
    weekStart: string,
    timeZone: string,
    events: CalendarWrite[],
  ): Promise<{ created: number; deleted: number; ids: string[] }>;
}

export function googleIsConfigured(): boolean {
  return (
    hasEnv("GOOGLE_CLIENT_ID") &&
    hasEnv("GOOGLE_CLIENT_SECRET") &&
    hasEnv("GOOGLE_REFRESH_TOKEN")
  );
}

export function eventPrefix(): string {
  return env("GCAL_EVENT_PREFIX", "[ODY] ");
}

/* ------------------------------------------------------------------ google */

class GoogleCalendarAdapter implements CalendarAdapter {
  readonly kind = "google" as const;

  private calendarId = env("GOOGLE_CALENDAR_ID", "primary");

  private api() {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.calendar({ version: "v3", auth });
  }

  async listWeek(weekStart: string, timeZone: string): Promise<CalendarEvent[]> {
    return this.listRange(weekStart, addDays(weekStart, 7), timeZone);
  }

  async listRange(
    fromDate: string,
    toDate: string,
    timeZone: string,
  ): Promise<CalendarEvent[]> {
    const timeMin = minutesToInstant(fromDate, 0, timeZone);
    const timeMax = minutesToInstant(toDate, 0, timeZone);

    const response = await this.api().events.list({
      calendarId: this.calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 500,
    });

    const prefix = eventPrefix();

    return (response.data.items ?? [])
      // All-day events carry `date` rather than `dateTime`. They are not
      // walls in the minute sense, so they are dropped rather than treated
      // as a 24-hour block that would empty the week.
      .filter((item) => item.start?.dateTime && item.end?.dateTime)
      .map((item) => ({
        id: item.id ?? "",
        summary: item.summary ?? "(no title)",
        start: item.start!.dateTime!,
        end: item.end!.dateTime!,
        location: item.location ?? null,
        isOurs: (item.summary ?? "").startsWith(prefix),
      }));
  }

  async writeWeek(weekStart: string, timeZone: string, events: CalendarWrite[]) {
    const api = this.api();
    const existing = await this.listWeek(weekStart, timeZone);
    const ours = existing.filter((event) => event.isOurs);

    // Clear our own events first so a re-run never leaves an orphan behind.
    for (const event of ours) {
      await api.events.delete({ calendarId: this.calendarId, eventId: event.id });
    }

    const ids: string[] = [];
    for (const event of events) {
      const created = await api.events.insert({
        calendarId: this.calendarId,
        requestBody: {
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.start.toISOString(), timeZone },
          end: { dateTime: event.end.toISOString(), timeZone },
          // §10: notifications on block start only.
          reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] },
        },
      });
      ids.push(created.data.id ?? "");
    }

    return { created: ids.length, deleted: ours.length, ids };
  }
}

/* -------------------------------------------------------------------- stub */

/**
 * Stands in for Google when no credentials are configured. It serves a fixed
 * but realistic coaching week so the scheduler has walls to fill around, and
 * it accepts writes without pretending they went anywhere.
 */
class StubCalendarAdapter implements CalendarAdapter {
  readonly kind = "stub" as const;

  private written = new Map<string, CalendarWrite[]>();

  async listWeek(weekStart: string, timeZone: string): Promise<CalendarEvent[]> {
    const walls = DEMO_CALENDAR.map((entry, index) => {
      const date = addDays(weekStart, entry.weekday);
      return {
        id: `stub-${weekStart}-${index}`,
        summary: entry.summary,
        start: minutesToInstant(date, clockToMinutes(entry.start), timeZone).toISOString(),
        end: minutesToInstant(date, clockToMinutes(entry.end), timeZone).toISOString(),
        location: null,
        isOurs: false,
      };
    });

    const ours = (this.written.get(weekStart) ?? []).map((event, index) => ({
      id: `stub-ours-${weekStart}-${index}`,
      summary: event.summary,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      location: null,
      isOurs: true,
    }));

    return [...walls, ...ours];
  }

  /** The demo week repeats, so a range is just each week in it, stitched. */
  async listRange(
    fromDate: string,
    toDate: string,
    timeZone: string,
  ): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];
    let cursor = weekOf(
      minutesToInstant(fromDate, 12 * 60, timeZone),
      timeZone,
    );
    // Guard against a runaway loop on a malformed range.
    for (let guard = 0; guard < 60 && cursor < toDate; guard++) {
      for (const event of await this.listWeek(cursor, timeZone)) {
        const day = isoDate(new Date(event.start), timeZone);
        if (day >= fromDate && day < toDate) events.push(event);
      }
      cursor = addDays(cursor, 7);
    }
    return events;
  }

  async writeWeek(weekStart: string, _timeZone: string, events: CalendarWrite[]) {
    const previous = this.written.get(weekStart)?.length ?? 0;
    this.written.set(weekStart, events);
    return {
      created: events.length,
      deleted: previous,
      ids: events.map((_, index) => `stub-ours-${weekStart}-${index}`),
    };
  }
}

function clockToMinutes(clock: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

/* ----------------------------------------------------------------- factory */

const ADAPTER_KEY = Symbol.for("odyssey.calendarAdapter");

export function calendar(): CalendarAdapter {
  const globalRef = globalThis as unknown as Record<symbol, CalendarAdapter | undefined>;
  if (!globalRef[ADAPTER_KEY]) {
    globalRef[ADAPTER_KEY] = googleIsConfigured()
      ? new GoogleCalendarAdapter()
      : new StubCalendarAdapter();
  }
  return globalRef[ADAPTER_KEY]!;
}

export const CALENDAR_TIME_ZONE = env("APP_TIME_ZONE", DEFAULT_TIME_ZONE);

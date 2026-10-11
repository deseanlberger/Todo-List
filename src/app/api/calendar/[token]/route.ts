import { NextResponse } from "next/server";
import { repository } from "@/lib/data";
import { hasEnv } from "@/lib/env";
import { addDays, isoDate } from "@/lib/domain/time";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { buildIcs } from "@/lib/ics/build";

export const dynamic = "force-dynamic";

/**
 * The calendar feed the phone subscribes to.
 *
 * The URL carries its own secret because a subscribed calendar cannot log
 * in: iOS fetches it in the background with no cookie, so the passcode gate
 * in middleware would turn every refresh into an unlock page. CALENDAR_TOKEN
 * is that credential. Changing it revokes the feed without touching
 * APP_PASSCODE, which is the point of keeping them separate — a URL that
 * ends up in a backup or a shared screenshot should not cost him the app.
 *
 * Unset means off, and off is a 404 rather than a 503: an unconfigured feed
 * should look like nothing is there, not like something exists and is
 * broken.
 */

/** Four weeks back for context, twelve ahead for the macrocycle. */
const DAYS_BACK = 28;
const DAYS_AHEAD = 84;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!hasEnv("CALENDAR_TOKEN")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { token } = await params;
  // Strip the .ics some clients insist on appending.
  const offered = token.replace(/\.ics$/i, "");
  if (!timingSafeEqual(offered, process.env.CALENDAR_TOKEN!)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const repo = repository();
  const today = isoDate(new Date(), CALENDAR_TIME_ZONE);

  const from = `${addDays(today, -DAYS_BACK)}T00:00:00Z`;
  const to = `${addDays(today, DAYS_AHEAD)}T00:00:00Z`;

  // Everything with a due date inside the window. The window exists so the
  // phone is not handed years of history on every refresh.
  const due = (await repo.listTasks()).filter(
    (task) => task.dueDate && task.dueDate >= from && task.dueDate <= to,
  );

  const minutes = Number(process.env.CALENDAR_ALARM_MINUTES ?? "10");

  const body = buildIcs(due, {
    alarmMinutes: Number.isFinite(minutes) ? minutes : 10,
    name: "Odyssey Scheduler",
    host: "odyssey-scheduler",
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Subscribed calendars are polled. Caching a stale copy at the edge
      // would hide a change he just made for as long as the cache lives.
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": 'inline; filename="odyssey-scheduler.ics"',
    },
  });
}

/**
 * Constant time, so the response time cannot be used to guess the token a
 * character at a time. Length is compared first and separately, which does
 * leak the length — that is fine and unavoidable, since a wrong length
 * cannot be a match anyway.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

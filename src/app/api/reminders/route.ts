import { NextResponse } from "next/server";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { hasEnv } from "@/lib/env";
import {
  MONTH_LABELS,
  addDays,
  isoDate,
  pad,
  parseIsoDate,
} from "@/lib/domain/time";
import { formatReminder, sendMessage, telegramIsConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * SCHEDULER_RULES §14. Each recurring task has a lead-time reminder, one day
 * before by default. Rent on the 31st means a ping on the 30th.
 *
 * Meant to be hit once a morning by a scheduler (Vercel cron). Telegram is
 * used for exactly two things: capturing tasks, and these reminders.
 */
export async function GET(request: Request) {
  const secret = hasEnv("CRON_SECRET") ? process.env.CRON_SECRET : null;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const repo = repository();

  // Read the database before anything below can return early.
  //
  // Supabase pauses a free project after seven idle days, and this cron is
  // the only thing in the whole system that runs on its own. The Telegram
  // check used to sit above the first read, so with Telegram unconfigured
  // this handler returned in milliseconds every morning and never touched
  // Postgres. The project paused, every page then threw on its first query,
  // and Today served its loading skeleton forever.
  //
  // Supabase's own wording is "a few user requests to the database each day",
  // so this deliberately issues several cheap reads rather than one. On a week
  // where the app is never opened, these are the only queries the database
  // sees, and a single row read sits right on the edge of the threshold.
  await Promise.all([repo.getSettings(), repo.listWindows(), repo.listTasks()]);

  const chatId = hasEnv("TELEGRAM_CHAT_ID") ? process.env.TELEGRAM_CHAT_ID : null;
  if (!telegramIsConfigured() || !chatId) {
    return NextResponse.json({
      sent: 0,
      reason: "Telegram is not configured",
      keptDatabaseAwake: true,
    });
  }

  const now = new Date();
  const today = isoDate(now, CALENDAR_TIME_ZONE);

  const tasks = await repo.listTasks();

  const due = tasks.filter((task) => {
    if (!task.isRecurring || task.status === "done" || !task.dueDate) return false;
    const dueDay = isoDate(new Date(task.dueDate), CALENDAR_TIME_ZONE);
    return addDays(today, task.reminderLeadDays) === dueDay;
  });

  for (const task of due) {
    // No placed-at time any more: nothing is scheduled into blocks, so a
    // reminder says what is due and when, and nothing about where it sits.
    await sendMessage(
      chatId,
      formatReminder(task, describeDay(task.dueDate!, today), null),
    );
  }

  return NextResponse.json({ sent: due.length });
}

/** `tomorrow, Aug 31` — the phrasing the design's reminder bubble uses. */
function describeDay(iso: string, today: string): string {
  const day = isoDate(new Date(iso), CALENDAR_TIME_ZONE);
  const { month, day: dayOfMonth } = parseIsoDate(day);
  const label = `${MONTH_LABELS[month - 1].charAt(0)}${MONTH_LABELS[month - 1]
    .slice(1)
    .toLowerCase()} ${pad(dayOfMonth)}`;
  return day === addDays(today, 1) ? `tomorrow, ${label}` : label;
}

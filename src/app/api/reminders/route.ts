import { NextResponse } from "next/server";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import {
  MONTH_LABELS,
  addDays,
  formatClock,
  isoDate,
  minutesOfDay,
  pad,
  parseIsoDate,
} from "@/lib/domain/time";
import { currentWeekStart } from "@/lib/schedule-run";
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
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!telegramIsConfigured() || !chatId) {
    return NextResponse.json({ sent: 0, reason: "Telegram is not configured" });
  }

  const repo = repository();
  const now = new Date();
  const today = isoDate(now, CALENDAR_TIME_ZONE);

  const [tasks, blocks] = await Promise.all([
    repo.listTasks(),
    repo.listBlocks(currentWeekStart(now)),
  ]);

  const due = tasks.filter((task) => {
    if (!task.isRecurring || task.status === "done" || !task.dueDate) return false;
    const dueDay = isoDate(new Date(task.dueDate), CALENDAR_TIME_ZONE);
    return addDays(today, task.reminderLeadDays) === dueDay;
  });

  for (const task of due) {
    const block = blocks.find((entry) => entry.taskId === task.id);
    const placedAt = block
      ? formatClock(minutesOfDay(new Date(block.startTime), CALENDAR_TIME_ZONE))
      : null;

    await sendMessage(
      chatId,
      formatReminder(task, describeDay(task.dueDate!, today), placedAt),
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

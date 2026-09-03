import { CALENDAR_TIME_ZONE, calendar } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { formatClock, minutesOfDay } from "@/lib/domain/time";
import { currentWeekStart } from "@/lib/schedule-run";
import { ReviewScreen } from "./review-screen";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const now = new Date();
  const pending = await repository().getPendingSchedule(currentWeekStart(now));

  return (
    <ReviewScreen
      diff={pending?.diff ?? null}
      clock={formatClock(minutesOfDay(now, CALENDAR_TIME_ZONE))}
      calendarKind={calendar().kind}
    />
  );
}

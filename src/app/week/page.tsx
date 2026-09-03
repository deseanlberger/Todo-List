import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { formatClock, minutesOfDay } from "@/lib/domain/time";
import { currentWeekStart } from "@/lib/schedule-run";
import { loadWeekView } from "@/lib/week-view";
import { WeekScreen } from "./week-screen";

export const dynamic = "force-dynamic";

export default async function WeekPage() {
  const now = new Date();
  const view = await loadWeekView(currentWeekStart(now), now);

  return (
    <WeekScreen
      view={view}
      clock={formatClock(minutesOfDay(now, CALENDAR_TIME_ZONE))}
    />
  );
}

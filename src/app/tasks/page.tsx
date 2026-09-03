import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { formatClock, minutesOfDay } from "@/lib/domain/time";
import { AllTasks } from "./all-tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const repo = repository();
  const [tasks, settings] = await Promise.all([repo.listTasks(), repo.getSettings()]);
  const now = new Date();

  return (
    <AllTasks
      tasks={tasks}
      clock={formatClock(minutesOfDay(now, CALENDAR_TIME_ZONE))}
      timeZone={CALENDAR_TIME_ZONE}
      initialSort={settings.defaultSort}
      nowIso={now.toISOString()}
    />
  );
}

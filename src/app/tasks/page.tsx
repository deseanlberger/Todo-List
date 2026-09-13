import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { todayIso } from "@/lib/day-slots";
import { AllTasks } from "./all-tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const repo = repository();
  const [tasks, settings] = await Promise.all([repo.listTasks(), repo.getSettings()]);

  return (
    <AllTasks
      tasks={tasks}
      timeZone={CALENDAR_TIME_ZONE}
      initialSort={settings.defaultSort}
      nowIso={new Date().toISOString()}
      // The local calendar date, not the UTC one: after 5pm Pacific those
      // are different days and the sheet would open on tomorrow.
      today={todayIso()}
    />
  );
}

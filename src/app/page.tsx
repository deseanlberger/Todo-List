import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { isoDate } from "@/lib/domain/time";
import { TaskList } from "./task-list";

// Live data on every load, and the root layout reads the saved theme.
// Without this Next prerenders "/" at build time and the build itself
// talks to the database.
export const dynamic = "force-dynamic";

export default async function Home() {
  const tasks = await repository().listTasks();
  return (
    <TaskList
      tasks={tasks}
      timeZone={CALENDAR_TIME_ZONE}
      today={isoDate(new Date(), CALENDAR_TIME_ZONE)}
    />
  );
}

import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { formatClock, minutesOfDay } from "@/lib/domain/time";
import { DelegateScreen } from "./delegate-screen";

export const dynamic = "force-dynamic";

export default async function DelegatePage() {
  const now = new Date();
  const tasks = await repository().listTasks();

  return (
    <DelegateScreen
      tasks={tasks.filter((task) => task.category === "delegate")}
      clock={formatClock(minutesOfDay(now, CALENDAR_TIME_ZONE))}
      timeZone={CALENDAR_TIME_ZONE}
      // The one recurring 30-minute slot that all handoffs live inside (§15).
      blockLabel="HANDOFF BLOCK · THU 13:00 – 13:30"
    />
  );
}

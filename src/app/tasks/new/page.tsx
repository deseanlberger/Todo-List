import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { formatClock, minutesOfDay } from "@/lib/domain/time";
import { TaskForm } from "../task-form";

export const dynamic = "force-dynamic";

export default function NewTaskPage() {
  const now = new Date();

  return (
    <TaskForm
      task={null}
      clock={formatClock(minutesOfDay(now, CALENDAR_TIME_ZONE))}
      timeZone={CALENDAR_TIME_ZONE}
      nowIso={now.toISOString()}
      history={[]}
    />
  );
}

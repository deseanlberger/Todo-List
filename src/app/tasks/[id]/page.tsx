import { notFound } from "next/navigation";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { formatClock, minutesOfDay } from "@/lib/domain/time";
import { TaskForm } from "../task-form";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = repository();
  const [task, history] = await Promise.all([
    repo.getTask(id),
    repo.listEstimationHistory(50),
  ]);

  if (!task) notFound();

  const now = new Date();

  return (
    <TaskForm
      task={task}
      clock={formatClock(minutesOfDay(now, CALENDAR_TIME_ZONE))}
      timeZone={CALENDAR_TIME_ZONE}
      nowIso={now.toISOString()}
      history={history}
    />
  );
}

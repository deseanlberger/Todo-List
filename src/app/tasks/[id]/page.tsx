import { notFound } from "next/navigation";
import { repository } from "@/lib/data";
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

  return <TaskForm task={task} nowIso={new Date().toISOString()} history={history} />;
}

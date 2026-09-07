import { TaskForm } from "../task-form";

export const dynamic = "force-dynamic";

export default function NewTaskPage() {
  return <TaskForm task={null} nowIso={new Date().toISOString()} history={[]} />;
}

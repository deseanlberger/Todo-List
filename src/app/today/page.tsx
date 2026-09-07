import { repository } from "@/lib/data";
import { loadTodayView } from "@/lib/today-view";
import { TodayScreen } from "./today-screen";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const now = new Date();
  const [view, settings] = await Promise.all([
    loadTodayView(now),
    repository().getSettings(),
  ]);

  const activeTask = view.activeEntry?.taskId
    ? await repository().getTask(view.activeEntry.taskId)
    : null;

  return (
    <TodayScreen
      view={view}
      resetMinutes={settings.resetMinutes}
      estimatedBlocks={activeTask?.estimatedBlocks ?? 1}
    />
  );
}

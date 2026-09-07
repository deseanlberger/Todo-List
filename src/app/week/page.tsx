import { resolveTargetWeek } from "@/lib/schedule-run";
import { loadWeekView } from "@/lib/week-view";
import { WeekScreen } from "./week-screen";

export const dynamic = "force-dynamic";

export default async function WeekPage() {
  const now = new Date();
  // The same week Schedule my week would act on, so the button and the list
  // never disagree about which week they mean.
  const weekStart = await resolveTargetWeek(now);
  return <WeekScreen view={await loadWeekView(weekStart, now)} />;
}

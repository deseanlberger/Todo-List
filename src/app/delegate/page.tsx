import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { DelegateScreen } from "./delegate-screen";

export const dynamic = "force-dynamic";

export default async function DelegatePage() {
  const tasks = await repository().listTasks();

  return (
    <DelegateScreen
      tasks={tasks.filter((task) => task.category === "delegate")}
      timeZone={CALENDAR_TIME_ZONE}
      // The one recurring 30-minute slot all handoffs live inside.
      blockLabel="Handoff block · Thursday 1:00 – 1:30 PM"
    />
  );
}

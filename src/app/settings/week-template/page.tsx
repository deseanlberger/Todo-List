import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { formatClock, minutesOfDay } from "@/lib/domain/time";
import { WeekTemplateEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function WeekTemplatePage() {
  const repo = repository();
  const [windows, settings] = await Promise.all([repo.listWindows(), repo.getSettings()]);

  return (
    <WeekTemplateEditor
      clock={formatClock(minutesOfDay(new Date(), CALENDAR_TIME_ZONE))}
      initialWindows={windows.map((window) => ({
        id: window.id,
        weekday: window.weekday,
        startTime: window.startTime,
        endTime: window.endTime,
        allowance: window.allowance,
        sortOrder: window.sortOrder,
      }))}
      initialCap={settings.deepFocusCap}
      initialReset={settings.resetMinutes}
      initialWeekendUncapped={settings.weekendUncapped}
    />
  );
}

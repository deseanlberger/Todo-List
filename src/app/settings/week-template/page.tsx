import { repository } from "@/lib/data";
import { WeekTemplateEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function WeekTemplatePage() {
  const repo = repository();
  const [windows, settings] = await Promise.all([repo.listWindows(), repo.getSettings()]);

  return (
    <WeekTemplateEditor
      initialWindows={windows.map((window) => ({
        id: window.id,
        weekday: window.weekday,
        startTime: window.startTime,
        endTime: window.endTime,
        allowance: window.allowance,
        label: window.label,
        sortOrder: window.sortOrder,
      }))}
      initialCap={settings.deepFocusCap}
      initialReset={settings.resetMinutes}
      initialWeekendUncapped={settings.weekendUncapped}
    />
  );
}

import { CALENDAR_TIME_ZONE, calendar } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { Content } from "@/components/chrome";
import { Group, Row, RowValue } from "@/components/ui";
import { parseClock } from "@/lib/domain/time";
import { AppearanceRow } from "./appearance-row";
import { SettingsChrome } from "./settings-chrome";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const repo = repository();
  const [settings, windows] = await Promise.all([repo.getSettings(), repo.listWindows()]);

  // The summary on the right of the row, so the week's shape is visible
  // without opening the editor.
  const openMinutes = windows
    .filter((window) => window.allowance !== "no_work")
    .reduce((total, w) => total + (parseClock(w.endTime) - parseClock(w.startTime)), 0);
  const openDays = new Set(
    windows.filter((w) => w.allowance !== "no_work").map((w) => w.weekday),
  ).size;

  const facts: [string, string][] = [
    ["Storage", repo.kind === "supabase" ? "Supabase" : "Demo, in memory"],
    ["Calendar", calendar().kind === "google" ? "Google Calendar" : "Not connected"],
    ["Time zone", CALENDAR_TIME_ZONE.replace("_", " ")],
    ["Event prefix", settings.gcalEventPrefix.trim()],
  ];

  return (
    <SettingsChrome>
      <Content className="pt-4">
        <Group footer="Time blocks are the only place the scheduler may put work. Set them once, per day of the week.">
          <Row href="/settings/week-template" chevron>
            <span className="t-body flex-1">Time blocks</span>
            <RowValue>
              {openMinutes === 0
                ? "None set"
                : `${formatHours(openMinutes)} · ${openDays} ${openDays === 1 ? "day" : "days"}`}
            </RowValue>
          </Row>
        </Group>

        <AppearanceRow initialTheme={settings.theme} />

        <Group footer="Nothing is written to the calendar without an approved diff.">
          {facts.map(([label, value]) => (
            <Row key={label}>
              <span className="t-body flex-1">{label}</span>
              <RowValue>{value}</RowValue>
            </Row>
          ))}
        </Group>
      </Content>
    </SettingsChrome>
  );
}

/** `7h 30m`, or `7h` on the hour. */
function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

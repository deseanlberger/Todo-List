import { CALENDAR_TIME_ZONE, calendar } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { Content } from "@/components/chrome";
import { AppearanceRow } from "./appearance-row";
import { SettingsChrome } from "./settings-chrome";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const repo = repository();
  const settings = await repo.getSettings();

  const facts: [string, string][] = [
    ["Storage", repo.kind === "supabase" ? "Supabase" : "Demo, in memory"],
    ["Calendar", calendar().kind === "google" ? "Google Calendar" : "Not connected"],
    ["Time zone", CALENDAR_TIME_ZONE.replace("_", " ")],
    ["Event prefix", settings.gcalEventPrefix.trim()],
    ["Deep focus cap", `${settings.deepFocusCap} per weekday`],
    ["Reset length", `${settings.resetMinutes} min`],
  ];

  return (
    <SettingsChrome>
      <Content className="pt-4">
        <SettingsGroup facts={[]}>
          <a href="/settings/week-template" className="ios-row pressable">
            <span className="t-body flex-1">Week template</span>
            <span className="t-body" style={{ color: "var(--label-2)" }}>
              When the week is open
            </span>
            <span style={{ color: "var(--label-3)" }}>›</span>
          </a>
        </SettingsGroup>

        <AppearanceRow initialTheme={settings.theme} />

        <SettingsGroup
          facts={facts}
          footer="Nothing is written to the calendar without an approved diff."
        />
      </Content>
    </SettingsChrome>
  );
}

function SettingsGroup({
  facts,
  footer,
  children,
}: {
  facts: [string, string][];
  footer?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="ios-group">
        {children}
        {facts.map(([label, value]) => (
          <div key={label} className="ios-row">
            <span className="t-body flex-1">{label}</span>
            <span className="t-body" style={{ color: "var(--label-2)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>
      {footer ? <div className="ios-group-footer">{footer}</div> : null}
    </section>
  );
}

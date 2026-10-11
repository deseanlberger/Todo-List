import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { Content } from "@/components/chrome";
import { Group, Row, RowValue } from "@/components/ui";
import { passcodeIsConfigured, passcodeIsWeak, MIN_PASSCODE_LENGTH } from "@/lib/auth";
import { LockRow } from "./lock-row";
import { SettingsChrome } from "./settings-chrome";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const repo = repository();

  // Only what is still true. The event prefix went with the scheduler: the
  // calendar feed publishes due dates and titles as they are.
  const facts: [string, string][] = [
    ["Storage", repo.kind === "supabase" ? "Supabase" : "Demo, in memory"],
    ["Time zone", CALENDAR_TIME_ZONE.replace("_", " ")],
    ["Reminders sync", "Hourly, from your Mac"],
  ];

  return (
    <SettingsChrome>
      <Content className="pt-4">
        <Group
          footer={
            passcodeIsConfigured()
              ? passcodeIsWeak()
                ? `Your passcode is under ${MIN_PASSCODE_LENGTH} characters. It works, but it is short enough to guess. Change APP_PASSCODE to something longer.`
                : "You will need the passcode again on this device."
              : "Anyone with this link can read and change everything. Set APP_PASSCODE to lock it."
          }
        >
          <Row>
            <span className="t-body flex-1">Passcode</span>
            <RowValue>
              {passcodeIsConfigured() ? (passcodeIsWeak() ? "Set, but weak" : "On") : "Off"}
            </RowValue>
          </Row>
          {passcodeIsConfigured() ? <LockRow /> : null}
        </Group>

        <Group footer="Reminders you add on your phone show up here on the next sync.">
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


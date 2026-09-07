import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CALENDAR_TIME_ZONE, calendar } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { formatClock, minutesOfDay } from "@/lib/domain/time";
import { Content } from "@/components/chrome";
import { SettingsChrome } from "./settings-chrome";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const now = new Date();
  const repo = repository();
  const settings = await repo.getSettings();

  const facts: [string, string][] = [
    ["STORAGE", repo.kind === "supabase" ? "SUPABASE" : "DEMO · IN MEMORY"],
    ["CALENDAR", calendar().kind === "google" ? "GOOGLE CALENDAR" : "STUB · NOT CONNECTED"],
    ["TIME ZONE", CALENDAR_TIME_ZONE.toUpperCase()],
    ["EVENT PREFIX", settings.gcalEventPrefix.trim()],
    ["DEEP FOCUS CAP", `${settings.deepFocusCap} PER WEEKDAY`],
    ["RESET LENGTH", `${settings.resetMinutes} MIN`],
  ];

  return (
    <SettingsChrome clock={formatClock(minutesOfDay(now, CALENDAR_TIME_ZONE))}>
      <Content>
        <Link
          href="/settings/week-template"
          className="press flex items-center justify-between border-t border-hairline py-[14px]"
        >
          <span className="t-section text-text-faded">WEEK TEMPLATE</span>
          <span className="flex items-center gap-2">
            <span className="t-meta text-text-secondary">WHEN THE WEEK IS OPEN</span>
            <ChevronRight size={14} strokeWidth={1.5} className="text-text-faded" />
          </span>
        </Link>

        {facts.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between border-t border-hairline py-[14px]"
          >
            <span className="t-section text-text-faded">{label}</span>
            <span className="t-meta text-text-secondary">{value}</span>
          </div>
        ))}

        <p className="t-meta mt-4 text-text-faded" style={{ lineHeight: 1.7 }}>
          NOTHING IS WRITTEN TO THE CALENDAR WITHOUT AN APPROVED DIFF.
        </p>
        <div className="h-4" />
      </Content>
    </SettingsChrome>
  );
}

import { CALENDAR_TIME_ZONE } from "@/lib/calendar";
import { addMonths, monthStart } from "@/lib/domain/time";
import { loadMonthView } from "@/lib/month-view";
import { MonthScreen } from "./month-screen";

export const dynamic = "force-dynamic";

export default async function MonthPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const now = new Date();
  const { m } = await searchParams;

  // `m` comes from the month arrows, so validate rather than trust it.
  const start = /^\d{4}-\d{2}-01$/.test(m ?? "")
    ? m!
    : monthStart(now, CALENDAR_TIME_ZONE);

  return (
    <MonthScreen
      view={await loadMonthView(start, now)}
      previousMonth={addMonths(start, -1)}
      nextMonth={addMonths(start, 1)}
    />
  );
}

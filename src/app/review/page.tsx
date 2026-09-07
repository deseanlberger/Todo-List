import { calendar } from "@/lib/calendar";
import { repository } from "@/lib/data";
import { resolveTargetWeek } from "@/lib/schedule-run";
import { ReviewScreen } from "./review-screen";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const pending = await repository().getPendingSchedule(await resolveTargetWeek());
  return <ReviewScreen diff={pending?.diff ?? null} calendarKind={calendar().kind} />;
}

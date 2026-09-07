import { repository } from "@/lib/data";
import { CommitmentsEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function CommitmentsPage() {
  const commitments = await repository().listCommitments();

  return (
    <CommitmentsEditor
      initial={commitments.map((commitment) => ({
        id: commitment.id,
        title: commitment.title,
        weekday: commitment.weekday,
        startTime: commitment.startTime,
        endTime: commitment.endTime,
        location: commitment.location,
        sortOrder: commitment.sortOrder,
      }))}
    />
  );
}

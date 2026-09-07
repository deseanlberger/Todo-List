import { ScreenSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <ScreenSkeleton title="Tasks" rows={8} segmented />;
}

import { redirect } from "next/navigation";
import { passcodeIsConfigured } from "@/lib/auth";
import { UnlockForm } from "./unlock-form";

export const dynamic = "force-dynamic";

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // With no passcode set there is nothing to unlock, and this screen would
  // be a dead end.
  if (!passcodeIsConfigured()) redirect("/today");

  const { next } = await searchParams;

  // Only ever a path on this app. Anything else is someone else's redirect.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/today";

  return <UnlockForm next={safeNext} />;
}

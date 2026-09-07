"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * A UIKit-style navigation bar: back on the left, title centred, one action
 * on the right. Used by the pushed screens — task detail, week template.
 */
export function NavBar({
  title,
  backLabel = "Back",
  onBack,
  trailing,
}: {
  title?: string;
  backLabel?: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div
      className="bar-blur flex shrink-0 items-center gap-2 px-2 py-2"
      style={{ borderBottom: "0.5px solid var(--separator)" }}
    >
      <button
        type="button"
        onClick={onBack ?? (() => router.back())}
        className="pressable-solid t-body flex min-w-[72px] items-center gap-0.5 rounded-lg py-1 pl-1 pr-2"
        style={{ color: "var(--blue)" }}
      >
        <ChevronLeft size={22} strokeWidth={2.5} className="-ml-1" />
        {backLabel}
      </button>

      <span className="t-headline min-w-0 flex-1 truncate text-center">{title}</span>

      <div className="flex min-w-[72px] justify-end pr-1">{trailing}</div>
    </div>
  );
}

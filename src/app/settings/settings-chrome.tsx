"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { StatusBar, TabBar } from "@/components/chrome";

export function SettingsChrome({
  clock,
  children,
}: {
  clock: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <>
      <StatusBar clock={clock} />
      <header className="shrink-0 px-[22px] pt-1.5 pb-3.5">
        <button
          type="button"
          onClick={() => router.back()}
          className="press -ml-1 mb-1.5 flex items-center gap-1 text-text-secondary"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          <span className="t-eyebrow">BACK</span>
        </button>
        <h1 className="t-screen-title">SETTINGS</h1>
      </header>
      {children}
      <TabBar />
    </>
  );
}

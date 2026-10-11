"use client";

import { NavBar } from "@/components/nav-bar";

export function SettingsChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar title="Settings" />
      {children}
    </>
  );
}

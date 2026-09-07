"use client";

import { NavBar } from "@/components/nav-bar";
import { TabBar } from "@/components/chrome";

export function SettingsChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar title="Settings" />
      {children}
      <TabBar />
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ListChecks,
  Moon,
  Send,
  Sun,
  Sunrise,
} from "lucide-react";
import { useTheme } from "./theme";

/**
 * The status bar. The handoff says to use the platform's, which a web app
 * cannot; this is the closest honest equivalent — the clock only, with the
 * theme toggle where the indicators would sit.
 */
export function StatusBar({ clock }: { clock: string }) {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <div className="flex h-11 shrink-0 items-center justify-between px-[22px]">
      <span
        className="font-display text-[15px] tracking-[0.06em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {clock}
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to the light view" : "Switch to the dark view"}
        className="press -mr-2 flex h-11 w-11 items-center justify-center text-text-secondary"
      >
        <Icon size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

interface HeaderProps {
  eyebrow?: string;
  title: string;
  large?: boolean;
  /** Right-hand column: a metric, an icon button, whatever the screen needs. */
  trailing?: React.ReactNode;
  padding?: string;
}

export function Header({
  eyebrow,
  title,
  large = false,
  trailing,
  padding = "px-[22px]",
}: HeaderProps) {
  return (
    <header className={`flex shrink-0 items-end justify-between pt-1.5 pb-3.5 ${padding}`}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="t-eyebrow mb-1.5 text-text-secondary">{eyebrow}</div>
        ) : null}
        <h1 className={large ? "t-screen-title-lg" : "t-screen-title"}>{title}</h1>
      </div>
      {trailing ? <div className="shrink-0 pl-3">{trailing}</div> : null}
    </header>
  );
}

/** The right-hand metric column: a Bebas number over a small label. */
export function HeaderMetric({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="text-right">
      <div
        className="t-numeral"
        style={{ color: accent ? "var(--gold-text)" : "var(--text)" }}
      >
        {value}
      </div>
      <div className="t-eyebrow mt-1 text-text-faded">{label}</div>
    </div>
  );
}

export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-t border-hairline px-[22px] py-3">{children}</div>
  );
}

const TABS = [
  { href: "/today", label: "TODAY", Icon: Sunrise },
  { href: "/week", label: "WEEK", Icon: CalendarDays },
  { href: "/tasks", label: "ALL TASKS", Icon: ListChecks },
  { href: "/delegate", label: "DELEGATE", Icon: Send },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 border-t border-hairline pt-[9px] pb-[18px]">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="press flex flex-1 flex-col items-center gap-1.5 py-1"
            style={{ color: active ? "var(--tab-active)" : "var(--tab-inactive)" }}
          >
            <Icon size={19} strokeWidth={1.5} />
            <span className="t-tab">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** The scrolling middle of a screen. */
export function Content({
  children,
  padding = "px-[22px]",
  className = "",
}: {
  children: React.ReactNode;
  padding?: string;
  className?: string;
}) {
  return (
    <main className={`no-scrollbar flex-1 overflow-y-auto ${padding} ${className}`}>
      {children}
    </main>
  );
}

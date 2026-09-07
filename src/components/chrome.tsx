"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ListChecks, Send, Sun } from "lucide-react";

/**
 * A large title, the way a UIKit navigation bar shows one: the title sits in
 * the content, big and bold, with any actions on a line above it.
 */
export function Header({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <header className="shrink-0 px-4 pt-2 pb-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-large-title">{title}</h1>
          {subtitle ? (
            <p className="t-subhead mt-0.5" style={{ color: "var(--label-2)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0 pb-1">{trailing}</div> : null}
      </div>
    </header>
  );
}

/** A round tappable icon in the top-right, like Reminders' list actions. */
export function IconButton({
  label,
  onClick,
  href,
  children,
  tint = "var(--blue)",
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  tint?: string;
}) {
  const className =
    "pressable flex h-11 w-11 items-center justify-center rounded-full";

  if (href) {
    return (
      <Link href={href} aria-label={label} className={className} style={{ color: tint }}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={className}
      style={{ color: tint }}
    >
      {children}
    </button>
  );
}

/** The scrolling middle of a screen. */
export function Content({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={`no-scrollbar flex-1 overflow-y-auto px-4 pb-4 ${className}`}>
      {children}
    </main>
  );
}

/** A bar pinned above the tab bar, for a screen's primary action. */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bar-blur shrink-0 px-4 pt-3 pb-3"
      style={{ borderTop: "0.5px solid var(--separator)" }}
    >
      {children}
    </div>
  );
}

interface Tab {
  href: string;
  label: string;
  Icon: typeof Sun;
  /** Other routes this tab owns, so the highlight follows a sub-view. */
  alsoMatches?: string[];
}

const TABS: Tab[] = [
  { href: "/today", label: "Today", Icon: Sun },
  { href: "/week", label: "Calendar", Icon: CalendarDays, alsoMatches: ["/month"] },
  { href: "/tasks", label: "Tasks", Icon: ListChecks },
  { href: "/delegate", label: "Delegate", Icon: Send },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="bar-blur flex shrink-0 pt-1.5 pb-[22px]"
      style={{ borderTop: "0.5px solid var(--separator)" }}
    >
      {TABS.map(({ href, label, Icon, alsoMatches }) => {
        const owns = [href, ...(alsoMatches ?? [])];
        const active = owns.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`),
        );
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-[3px] pt-1"
            style={{ color: active ? "var(--blue)" : "var(--gray)" }}
          >
            <Icon size={25} strokeWidth={active ? 2.2 : 1.8} />
            <span className="t-caption2" style={{ fontWeight: 500 }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

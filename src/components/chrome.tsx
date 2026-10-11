"use client";

import Image from "next/image";
import Link from "next/link";
import { Settings } from "lucide-react";

/**
 * A large title, the way a UIKit navigation bar shows one: the title sits in
 * the content, big and bold, with any actions on a line above it.
 */
export function Header({
  title,
  subtitle,
  trailing,
  badge = false,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  /** The circle badge, on the one screen that is the app's front door. */
  badge?: boolean;
}) {
  return (
    <header className="shrink-0 px-4 pt-2 pb-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {badge ? (
            /* The badge already contains the wordmark, so the title beside
             * it is the screen's name and never "Odyssey Performance". */
            <Image
              src="/brand/odyssey-badge.png"
              alt="Odyssey Performance"
              width={34}
              height={34}
              priority
              className="shrink-0"
              style={{ width: 34, height: 34 }}
            />
          ) : null}
          <div className="min-w-0">
          <h1 className="t-large-title">{title}</h1>
          {subtitle ? (
            <p className="t-subhead mt-0.5" style={{ color: "var(--label-2)" }}>
              {subtitle}
            </p>
          ) : null}
          </div>
        </div>
        {trailing ? (
          <div className="flex shrink-0 items-center pb-1">{trailing}</div>
        ) : null}
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

/**
 * The settings gear. It lives in the top-right of every root screen, always
 * in the same place, so Settings is one tap away wherever you are.
 */
export function SettingsGear() {
  return (
    <IconButton label="Settings" href="/settings" tint="var(--label-2)">
      <Settings size={22} strokeWidth={2} />
    </IconButton>
  );
}


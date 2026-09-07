"use client";

import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { CATEGORIES } from "@/lib/domain/categories";
import type { TaskCategory } from "@/lib/domain/types";

/* ------------------------------------------------------------------ colour */

const CSS_KEY: Record<TaskCategory, string> = {
  deep_focus: "deep-focus",
  high_priority_admin: "high-priority-admin",
  low_priority_admin: "low-priority-admin",
  personal: "personal",
  delegate: "delegate",
};

export function categoryColor(category: TaskCategory): string {
  return `var(--cat-${CSS_KEY[category]})`;
}

export function categoryLabel(category: TaskCategory): string {
  return CATEGORIES[category].label;
}

/** The coloured dot Reminders uses to stand for a list. */
export function Dot({
  color,
  size = 10,
}: {
  color: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
}

/* ------------------------------------------------------------------- lists */

/** An inset grouped list: one rounded card holding rows. */
export function Group({
  header,
  footer,
  children,
  className = "",
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-6 ${className}`}>
      {header ? <div className="ios-group-header">{header}</div> : null}
      <div className="ios-group">{children}</div>
      {footer ? <div className="ios-group-footer">{footer}</div> : null}
    </section>
  );
}

/**
 * One row. `inset` pulls the separator past a leading dot or icon, matching
 * how UITableView insets it past the row's content.
 */
export function Row({
  children,
  onClick,
  href,
  inset = false,
  chevron = false,
  className = "",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  inset?: boolean;
  chevron?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const classes = `ios-row ${inset ? "ios-row-inset" : ""} ${
    onClick || href ? "pressable" : ""
  } ${className}`;

  const body = (
    <>
      {children}
      {chevron ? (
        <ChevronRight
          size={17}
          strokeWidth={2.5}
          className="-mr-1 shrink-0"
          style={{ color: "var(--label-3)" }}
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} style={style}>
        {body}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full ${classes}`} style={style}>
        {body}
      </button>
    );
  }

  return (
    <div className={classes} style={style}>
      {body}
    </div>
  );
}

/** The greyed value on the right of a settings row. */
export function RowValue({ children }: { children: ReactNode }) {
  return (
    <span className="t-body tnum shrink-0" style={{ color: "var(--label-2)" }}>
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- buttons */

type ButtonKind = "filled" | "tinted" | "plain" | "gray";

export function Button({
  label,
  onClick,
  kind = "tinted",
  tint = "var(--blue)",
  disabled = false,
  full = false,
  className = "",
  style,
}: {
  label: string;
  onClick?: () => void;
  kind?: ButtonKind;
  tint?: string;
  disabled?: boolean;
  full?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const base =
    "pressable-solid t-headline flex items-center justify-center rounded-[12px] px-4 py-[14px] text-center disabled:opacity-40";

  const kinds: Record<ButtonKind, CSSProperties> = {
    filled: { background: tint, color: "#fff" },
    tinted: { background: "var(--fill)", color: tint },
    gray: { background: "var(--fill)", color: "var(--label)" },
    plain: { background: "transparent", color: tint },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${full ? "w-full" : ""} ${className}`}
      style={{ ...kinds[kind], ...style }}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------- segmented control */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex gap-[2px] rounded-[9px] p-[2px] ${className}`}
      style={{ background: "var(--fill)" }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className="t-footnote flex-1 rounded-[7px] py-[6px] text-center"
            style={{
              fontWeight: active ? 600 : 400,
              background: active ? "var(--card)" : "transparent",
              color: "var(--label)",
              boxShadow: active
                ? "0 3px 8px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.04)"
                : "none",
              transition: "background-color 150ms ease-out",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ switch */

export function Switch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 rounded-full"
      style={{
        width: 51,
        height: 31,
        background: checked ? "var(--green)" : "var(--fill)",
        transition: "background-color 200ms ease-out",
      }}
    >
      <span
        className="absolute rounded-full bg-white"
        style={{
          width: 27,
          height: 27,
          top: 2,
          left: checked ? 22 : 2,
          boxShadow: "0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.06)",
          transition: "left 200ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------- stars */

/**
 * The importance editor. This is the task's `financial_impact` field, not a
 * second parallel rating. Each star keeps a 44pt tap target.
 */
export function Stars({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div
      className="-my-[13px] flex items-center"
      role={readOnly ? "img" : "radiogroup"}
      aria-label={`Importance ${value} of 5`}
    >
      {[1, 2, 3, 4, 5].map((index) => {
        const filled = index <= value;
        const star = (
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <polygon
              points="12,2.5 15.09,8.76 22,9.77 17,14.64 18.18,21.52 12,18.27 5.82,21.52 7,14.64 2,9.77 8.91,8.76"
              fill={filled ? "var(--orange)" : "none"}
              stroke={filled ? "var(--orange)" : "var(--label-4)"}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        );

        if (readOnly) {
          return (
            <span key={index} className="flex h-11 w-[17px] items-center justify-center">
              {star}
            </span>
          );
        }

        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={value === index}
            aria-label={`Set importance to ${index}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange?.(index);
            }}
            className="flex h-11 w-[17px] items-center justify-center"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ states */

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="px-8 py-16 text-center">
      <p className="t-title3" style={{ color: "var(--label-2)" }}>
        {title}
      </p>
      {detail ? (
        <p className="t-subhead mt-1.5" style={{ color: "var(--label-3)" }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

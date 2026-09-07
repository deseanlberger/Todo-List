"use client";

import type { CSSProperties } from "react";
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

/** The 3px rail colour — identical in both views. */
export function railColor(category: TaskCategory): string {
  return `var(--cat-${CSS_KEY[category]})`;
}

/** The category label colour — differs between views. */
export function labelColor(category: TaskCategory): string {
  return `var(--cat-${CSS_KEY[category]}-label)`;
}

export function categoryLabel(category: TaskCategory): string {
  return CATEGORIES[category].label;
}

/* ----------------------------------------------------------------- buttons */

type ButtonTone = "gold" | "hairline" | "antique" | "urgent";

const TONE_STYLE: Record<ButtonTone, CSSProperties> = {
  gold: { background: "var(--gold)", color: "#000", border: "1px solid var(--gold)" },
  hairline: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--hairline)",
  },
  antique: {
    background: "transparent",
    color: "var(--antique-gold)",
    border: "1px solid var(--antique-gold)",
  },
  urgent: {
    background: "transparent",
    color: "var(--urgent)",
    border: "1px solid var(--urgent)",
  },
};

export function Button({
  tone = "hairline",
  label,
  onClick,
  type = "button",
  disabled = false,
  className = "",
  style,
}: {
  tone?: ButtonTone;
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`press ${tone === "gold" ? "press-gold" : ""} t-button-sm rounded-[2px] py-[11px] text-center disabled:opacity-40 ${className}`}
      style={{ ...TONE_STYLE[tone], ...style }}
    >
      {label}
    </button>
  );
}

/** The full-width gold call to action: SCHEDULE MY WEEK, SAVE TEMPLATE. */
export function PrimaryButton({
  label,
  onClick,
  disabled = false,
  pending = false,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="press press-gold t-button w-full rounded-[2px] py-[13px] text-center disabled:opacity-40"
      style={{ background: "var(--gold)", color: "#000" }}
    >
      {pending ? "WORKING…" : label}
    </button>
  );
}

/* ------------------------------------------------------------------- chips */

export function Chip({
  label,
  selected,
  onClick,
  className = "",
}: {
  label: string;
  selected: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press t-chip flex-1 rounded-[2px] py-[9px] text-center ${className}`}
      style={
        selected
          ? {
              // Gold is the accent on dark; on paper the accent inverts to ink.
              background: "var(--tab-active)",
              color: "var(--bg)",
              border: "1px solid var(--tab-active)",
            }
          : {
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--hairline)",
            }
      }
    >
      {label}
    </button>
  );
}

/** A two-segment toggle: HOME / GYM, 10 MIN / 15 MIN. */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex overflow-hidden rounded-[2px] border border-hairline"
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
            className="press t-cat px-[14px] py-[6px]"
            style={{
              background: active ? "var(--gold)" : "transparent",
              color: active ? "#000" : "var(--text-secondary)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- stars */

/**
 * The five-star importance editor. This is the task's `financial_impact`
 * field, not a second parallel rating.
 *
 * The glyph is 13px but each star gets a 44px tap target, collapsed back with
 * a negative margin so the row still measures 14px.
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
      className="-my-[15px] flex items-center gap-[3px]"
      role={readOnly ? "img" : "radiogroup"}
      aria-label={`Financial impact ${value} of 5`}
    >
      {[1, 2, 3, 4, 5].map((index) => {
        const filled = index <= value;
        const star = (
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
            <polygon
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              fill={filled ? "var(--star-fill)" : "none"}
              stroke={filled ? "var(--star-fill)" : "var(--star-empty)"}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        );

        if (readOnly) {
          return (
            <span key={index} className="flex h-11 w-[13px] items-center justify-center">
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
            className="flex h-11 w-[13px] items-center justify-center"
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- sections */

/** `DEEP FOCUS · 5` — label, a hairline filling the row, then the count. */
export function SectionLabel({
  label,
  count,
  color = "var(--text-faded)",
  hint,
}: {
  label: string;
  count?: number | string;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-3 pt-4 first:pt-0">
      <span className="t-section shrink-0" style={{ color }}>
        {label}
      </span>
      <span className="h-px flex-1 bg-hairline" />
      {hint ? <span className="t-meta shrink-0 text-text-faded">{hint}</span> : null}
      {count !== undefined ? (
        <span className="t-meta shrink-0 text-text-faded">{count}</span>
      ) : null}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="t-sub border border-dashed border-hairline px-3 py-6 text-center text-text-faded">
      {children}
    </div>
  );
}

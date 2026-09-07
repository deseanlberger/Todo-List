"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Content, Header, TabBar } from "@/components/chrome";
import { Dot, EmptyState, Group, Segmented, categoryColor } from "@/components/ui";
import { CATEGORIES } from "@/lib/domain/categories";
import { WEEKDAY_SHORT, formatClock12, formatDayLong } from "@/lib/domain/time";
import type { MonthDay, MonthView } from "@/lib/view-types";

export function MonthScreen({
  view,
  previousMonth,
  nextMonth,
}: {
  view: MonthView;
  previousMonth: string;
  nextMonth: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(view.initialDate);

  const day =
    view.weeks.flat().find((entry) => entry.date === selected) ?? null;

  return (
    <>
      <Header
        title="Calendar"
        subtitle={view.label}
        trailing={
          <div className="-mr-2 flex items-center">
            <Link
              href={`/month?m=${previousMonth}`}
              aria-label="Previous month"
              className="pressable flex h-11 w-9 items-center justify-center"
              style={{ color: "var(--blue)" }}
            >
              <ChevronLeft size={22} strokeWidth={2.5} />
            </Link>
            <Link
              href={`/month?m=${nextMonth}`}
              aria-label="Next month"
              className="pressable flex h-11 w-9 items-center justify-center"
              style={{ color: "var(--blue)" }}
            >
              <ChevronRight size={22} strokeWidth={2.5} />
            </Link>
          </div>
        }
      />

      <div className="shrink-0 px-4 pb-3">
        <Segmented
          ariaLabel="Calendar range"
          value="month"
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          onChange={(value) => {
            if (value === "week") router.push("/week");
          }}
        />
      </div>

      <Content>
        <Group>
          <div className="px-2 pt-2 pb-3">
            <div className="mb-1 flex">
              {WEEKDAY_SHORT.map((label) => (
                <span
                  key={label}
                  className="t-caption2 flex-1 text-center"
                  style={{ color: "var(--label-2)" }}
                >
                  {label.charAt(0)}
                </span>
              ))}
            </div>

            {view.weeks.map((week, index) => (
              <div key={index} className="flex">
                {week.map((entry) => (
                  <DayCell
                    key={entry.date}
                    day={entry}
                    selected={entry.date === selected}
                    onSelect={() => setSelected(entry.date)}
                  />
                ))}
              </div>
            ))}
          </div>
        </Group>

        {day ? (
          <Group
            header={formatDayLong(day.date, weekdayIndex(day.date, view))}
            footer={
              day.deepFocusBlocks > 0
                ? `${day.deepFocusBlocks} deep focus ${
                    day.deepFocusBlocks === 1 ? "block" : "blocks"
                  }.`
                : undefined
            }
          >
            {day.entries.filter((entry) => !entry.isReset).length === 0 ? (
              <div className="ios-row">
                <span className="t-body" style={{ color: "var(--label-2)" }}>
                  Nothing on this day
                </span>
              </div>
            ) : null}

            {day.entries
              .filter((entry) => !entry.isReset)
              .map((entry, index) => (
                <div key={`${entry.title}-${index}`} className="ios-row ios-row-inset">
                  <span
                    className="t-footnote tnum w-[52px] shrink-0 text-right"
                    style={{ color: "var(--label-2)" }}
                  >
                    {formatClock12(entry.start)}
                  </span>
                  {entry.category ? (
                    <Dot color={categoryColor(entry.category)} />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="h-[10px] w-[10px] shrink-0 rounded-full"
                      style={{ border: "1.5px dashed var(--label-3)" }}
                    />
                  )}
                  <span
                    className="t-body min-w-0 flex-1 truncate"
                    style={{
                      color: entry.locked ? "var(--label-2)" : "var(--label)",
                      textDecoration: entry.done ? "line-through" : undefined,
                    }}
                  >
                    {entry.title}
                  </span>
                  {entry.category ? (
                    <span className="t-caption shrink-0" style={{ color: "var(--label-3)" }}>
                      {short(CATEGORIES[entry.category].label)}
                    </span>
                  ) : null}
                </div>
              ))}
          </Group>
        ) : (
          <EmptyState title="Pick a day" />
        )}
      </Content>

      <TabBar />
    </>
  );
}

/**
 * One day. Today gets the filled blue disc iOS Calendar uses; the selected
 * day gets a ring so the two can be true at once.
 */
function DayCell({
  day,
  selected,
  onSelect,
}: {
  day: MonthDay;
  selected: boolean;
  onSelect: () => void;
}) {
  const dim = !day.inMonth;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${day.date}, ${day.blockCount} blocks`}
      aria-pressed={selected}
      className="flex flex-1 flex-col items-center gap-[3px] py-[5px]"
    >
      <span
        className="t-subhead tnum flex h-[30px] w-[30px] items-center justify-center rounded-full"
        style={{
          background: day.isToday
            ? "var(--blue)"
            : selected
              ? "var(--fill)"
              : "transparent",
          color: day.isToday
            ? "#fff"
            : dim
              ? "var(--label-3)"
              : day.isPast
                ? "var(--label-2)"
                : "var(--label)",
          fontWeight: day.isToday || selected ? 600 : 400,
          boxShadow: selected && !day.isToday ? "inset 0 0 0 1.5px var(--blue)" : "none",
        }}
      >
        {day.dayOfMonth}
      </span>

      {/* At most three dots: any more and the row stops reading as a day. */}
      <span className="flex h-[5px] items-center gap-[2px]">
        {day.categories.slice(0, 3).map((category) => (
          <span
            key={category}
            className="h-[5px] w-[5px] rounded-full"
            style={{ background: categoryColor(category), opacity: dim ? 0.4 : 1 }}
          />
        ))}
        {day.categories.length === 0 && day.lockedCount > 0 ? (
          <span
            className="h-[5px] w-[5px] rounded-full"
            style={{ background: "var(--label-4)" }}
          />
        ) : null}
      </span>
    </button>
  );
}

function short(label: string): string {
  const sentence = label.charAt(0) + label.slice(1).toLowerCase();
  return sentence.replace("High priority admin", "Hi-pri").replace("Low priority admin", "Lo-pri");
}

/** 0 = Monday, matching the grid's column order. */
function weekdayIndex(date: string, view: MonthView): number {
  for (const week of view.weeks) {
    const index = week.findIndex((entry) => entry.date === date);
    if (index >= 0) return index;
  }
  return 0;
}

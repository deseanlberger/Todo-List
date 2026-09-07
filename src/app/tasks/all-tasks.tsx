"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { saveSortMode, setImportance } from "@/app/actions";
import { Content, Header, StatusBar, TabBar } from "@/components/chrome";
import { TaskRow } from "@/components/task-row";
import { Chip, EmptyState, SectionLabel, labelColor } from "@/components/ui";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/domain/categories";
import { isUrgent } from "@/lib/domain/priority";
import type { SortMode, Task, TaskCategory } from "@/lib/domain/types";

const SORT_CHIPS: { value: SortMode; label: string }[] = [
  { value: "category", label: "CATEGORY" },
  { value: "due", label: "DUE DATE" },
  { value: "stars", label: "STARS" },
];

const SORT_EXPLANATION: Record<SortMode, string> = {
  category: "GROUPED BY CATEGORY · DEEP FOCUS OUTRANKS ADMIN AT EQUAL SCORES",
  due: "SORTED BY DUE DATE · ANYTHING INSIDE 48H READS URGENT",
  stars: "SORTED BY YOUR STAR RATING · TAP ANY STAR TO RE-RATE",
};

interface Group {
  key: string;
  label: string;
  color?: string;
  count: number;
  tasks: Task[];
}

export function AllTasks({
  tasks,
  clock,
  timeZone,
  initialSort,
  nowIso,
}: {
  tasks: Task[];
  clock: string;
  timeZone: string;
  initialSort: SortMode;
  nowIso: string;
}) {
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [, startTransition] = useTransition();

  // Re-rating a star must feel instant; the write follows behind.
  const [optimistic, applyRating] = useOptimistic(
    tasks,
    (current: Task[], change: { id: string; value: number }) =>
      current.map((task) =>
        task.id === change.id ? { ...task, financialImpact: change.value } : task,
      ),
  );

  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const open = useMemo(
    () => optimistic.filter((task) => task.status !== "done"),
    [optimistic],
  );

  const visible = useMemo(() => {
    if (!query.trim()) return open;
    const needle = query.trim().toLowerCase();
    return open.filter((task) => task.title.toLowerCase().includes(needle));
  }, [open, query]);

  const groups = useMemo(() => buildGroups(visible, sort), [visible, sort]);

  const rate = (task: Task, value: number) => {
    startTransition(() => {
      applyRating({ id: task.id, value });
      void setImportance(task.id, value);
    });
  };

  const chooseSort = (value: SortMode) => {
    setSort(value);
    startTransition(() => {
      void saveSortMode(value);
    });
  };

  return (
    <>
      <StatusBar clock={clock} />
      <Header
        eyebrow={`${open.length} OPEN`}
        title="ALL TASKS"
        padding="px-5"
        trailing={
          <div className="flex items-center gap-1">
            <Link
              href="/tasks/new"
              aria-label="Add a task"
              className="press flex h-11 w-9 items-center justify-center text-text-secondary"
            >
              <Plus size={20} strokeWidth={1.5} />
            </Link>
            <button
              type="button"
              aria-label="Search tasks"
              aria-expanded={searching}
              onClick={() => {
                setSearching((value) => !value);
                if (searching) setQuery("");
              }}
              className="press -mr-2 flex h-11 w-9 items-center justify-center"
              style={{ color: searching ? "var(--gold-text)" : "var(--text-secondary)" }}
            >
              <Search size={20} strokeWidth={1.5} />
            </button>
          </div>
        }
      />

      <div className="shrink-0 px-5">
        {searching ? (
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="FILTER BY TITLE"
            aria-label="Filter tasks by title"
            className="t-chip mb-2 w-full rounded-[2px] border border-hairline bg-panel px-3 py-[9px] text-text outline-none placeholder:text-text-faded"
          />
        ) : null}

        <div className="flex gap-1.5">
          {SORT_CHIPS.map((chip) => (
            <Chip
              key={chip.value}
              label={chip.label}
              selected={sort === chip.value}
              onClick={() => chooseSort(chip.value)}
            />
          ))}
        </div>
        {/* At 9px this runs to ~357px, wider than the 350px the frame
            allows, so it wraps to a second line rather than being cut. */}
        <p
          className="t-meta mt-2.5 mb-3 text-text-faded"
          style={{ lineHeight: 1.5 }}
        >
          {SORT_EXPLANATION[sort]}
        </p>
      </div>

      <Content padding="px-5">
        {groups.length === 0 ? (
          <EmptyState>
            {query.trim()
              ? "Nothing matches that."
              : "Nothing open. Capture something and it lands here."}
          </EmptyState>
        ) : null}

        {groups.map((group) => (
          <section key={group.key}>
            <SectionLabel label={group.label} count={group.count} color={group.color} />
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                timeZone={timeZone}
                urgent={isUrgent(task, now)}
                onRate={(value) => rate(task, value)}
              />
            ))}
          </section>
        ))}
        <div className="h-4" />
      </Content>

      <TabBar />
    </>
  );
}

/* ------------------------------------------------------------------ sorts */

function buildGroups(tasks: Task[], sort: SortMode): Group[] {
  if (sort === "category") {
    return CATEGORY_ORDER.map((category) => {
      const inGroup = tasks
        .filter((task) => task.category === category)
        .sort(byDueAscending);
      return {
        key: category,
        label: headerFor(category),
        color: labelColor(category),
        count: inGroup.length,
        tasks: inGroup,
      };
    }).filter((group) => group.tasks.length > 0);
  }

  if (sort === "due") {
    return single("SOONEST FIRST · NO DATE LAST", [...tasks].sort(byDueAscending));
  }

  return single(
    "MOST IMPORTANT FIRST",
    [...tasks].sort(
      (a, b) => b.financialImpact - a.financialImpact || byDueAscending(a, b),
    ),
  );

  function single(label: string, sorted: Task[]): Group[] {
    if (sorted.length === 0) return [];
    return [{ key: label, label, count: sorted.length, tasks: sorted }];
  }
}

function headerFor(category: TaskCategory): string {
  // Delegate items never claim calendar time, and the header says so.
  return category === "delegate"
    ? "DELEGATE · NOT SCHEDULED"
    : CATEGORIES[category].label;
}

/** Ascending, with no-date last. */
function byDueAscending(a: Task, b: Task): number {
  if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

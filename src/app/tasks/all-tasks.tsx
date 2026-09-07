"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import { saveSortMode, setImportance, setTaskDone } from "@/app/actions";
import { Content, Header, IconButton, SettingsGear, TabBar } from "@/components/chrome";
import { QuickAddButton } from "@/components/quick-add";
import { TaskRow } from "@/components/task-row";
import { Dot, EmptyState, Group, Row, Segmented, categoryColor } from "@/components/ui";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/domain/categories";
import { isUrgent } from "@/lib/domain/priority";
import type { SortMode, Task, TaskCategory } from "@/lib/domain/types";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "due", label: "Due date" },
  { value: "stars", label: "Importance" },
];

const SORT_FOOTNOTE: Record<SortMode, string> = {
  category: "Grouped by category. Deep focus outranks admin at equal scores.",
  due: "Soonest first, no date last. Anything inside 48 hours reads red.",
  stars: "Most important first. Tap any star to re-rate.",
};

interface ListGroup {
  key: string;
  header: string;
  category: TaskCategory | null;
  tasks: Task[];
}

export function AllTasks({
  tasks,
  timeZone,
  initialSort,
  nowIso,
}: {
  tasks: Task[];
  timeZone: string;
  initialSort: SortMode;
  nowIso: string;
}) {
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [, startTransition] = useTransition();

  // Both edits must feel instant; the write follows behind. One reducer for
  // the two of them, so a tick and a re-rate can not stomp on each other.
  type Edit =
    | { kind: "rate"; id: string; value: number }
    | { kind: "done"; id: string; done: boolean };

  const [optimistic, applyEdit] = useOptimistic(
    tasks,
    (current: Task[], edit: Edit) =>
      current.map((task) => {
        if (task.id !== edit.id) return task;
        return edit.kind === "rate"
          ? { ...task, financialImpact: edit.value }
          : { ...task, status: edit.done ? ("done" as const) : ("backlog" as const) };
      }),
  );

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const open = useMemo(() => optimistic.filter((t) => t.status !== "done"), [optimistic]);

  const done = useMemo(
    () =>
      optimistic
        .filter((task) => task.status === "done")
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [optimistic],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return open;
    return open.filter((task) => task.title.toLowerCase().includes(needle));
  }, [open, query]);

  const groups = useMemo(() => buildGroups(visible, sort), [visible, sort]);

  const rate = (task: Task, value: number) => {
    startTransition(() => {
      applyEdit({ kind: "rate", id: task.id, value });
      void setImportance(task.id, value);
    });
  };

  const toggleDone = (task: Task, done: boolean) => {
    startTransition(() => {
      applyEdit({ kind: "done", id: task.id, done });
      void setTaskDone(task.id, done);
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
      <Header
        title="Tasks"
        subtitle={`${open.length} open`}
        trailing={
          <div className="-mr-2 flex items-center">
            <IconButton
              label={searching ? "Close search" : "Search tasks"}
              onClick={() => {
                setSearching((value) => !value);
                if (searching) setQuery("");
              }}
            >
              {searching ? <X size={22} /> : <Search size={21} strokeWidth={2.2} />}
            </IconButton>
            <IconButton label="Add a task" href="/tasks/new">
              <Plus size={25} strokeWidth={2.2} />
            </IconButton>
            <QuickAddButton />
            <SettingsGear />
          </div>
        }
      />

      <div className="shrink-0 px-4 pb-3">
        {searching ? (
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search tasks"
            className="t-body mb-3 w-full rounded-[10px] px-3 py-2 outline-none"
            style={{ background: "var(--fill)", color: "var(--label)" }}
          />
        ) : null}

        <Segmented
          ariaLabel="Sort tasks"
          options={SORT_OPTIONS}
          value={sort}
          onChange={chooseSort}
        />
        <p className="t-footnote mt-2" style={{ color: "var(--label-2)" }}>
          {SORT_FOOTNOTE[sort]}
        </p>
      </div>

      <Content>
        {groups.length === 0 ? (
          <EmptyState
            title={query.trim() ? "No results" : "All clear"}
            detail={
              query.trim()
                ? "Nothing matches that search."
                : "Capture something and it lands here."
            }
          />
        ) : null}

        {groups.map((group) => (
          <Group
            key={group.key}
            header={
              <span className="flex items-center gap-2">
                {group.category ? (
                  <Dot color={categoryColor(group.category)} size={8} />
                ) : null}
                {group.header}
                <span style={{ color: "var(--label-3)" }}>{group.tasks.length}</span>
              </span>
            }
          >
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                timeZone={timeZone}
                urgent={isUrgent(task, now)}
                onRate={(value) => rate(task, value)}
                onToggleDone={(done) => toggleDone(task, done)}
                showCategory={sort !== "category"}
              />
            ))}
          </Group>
        ))}

        {/* Ticked-off work, newest first, so a mistake is one tap to undo
            instead of gone forever. Collapsed by default: it is history. */}
        {done.length > 0 ? (
          <Group
            header={
              <button
                type="button"
                onClick={() => setShowDone((value) => !value)}
                className="pressable-solid flex items-center gap-1.5"
                aria-expanded={showDone}
              >
                <span>Completed</span>
                <span style={{ color: "var(--label-3)" }}>{done.length}</span>
                <ChevronRight
                  size={14}
                  strokeWidth={2.5}
                  style={{
                    color: "var(--label-3)",
                    transform: showDone ? "rotate(90deg)" : undefined,
                    transition: "transform 150ms ease-out",
                  }}
                />
              </button>
            }
          >
            {showDone ? (
              done.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  timeZone={timeZone}
                  urgent={false}
                  onRate={(value) => rate(task, value)}
                  onToggleDone={(value) => toggleDone(task, value)}
                />
              ))
            ) : (
              <Row onClick={() => setShowDone(true)}>
                <span className="t-body flex-1" style={{ color: "var(--blue)" }}>
                  Show completed
                </span>
              </Row>
            )}
          </Group>
        ) : null}
      </Content>

      <TabBar />
    </>
  );
}

/* ------------------------------------------------------------------ sorts */

function buildGroups(tasks: Task[], sort: SortMode): ListGroup[] {
  if (sort === "category") {
    return CATEGORY_ORDER.map((category) => ({
      key: category,
      header:
        category === "delegate"
          ? "Delegate · not scheduled"
          : sentence(CATEGORIES[category].label),
      category,
      tasks: tasks.filter((task) => task.category === category).sort(byDueAscending),
    })).filter((group) => group.tasks.length > 0);
  }

  if (sort === "due") {
    return single("Soonest first", [...tasks].sort(byDueAscending));
  }

  return single(
    "Most important first",
    [...tasks].sort((a, b) => b.financialImpact - a.financialImpact || byDueAscending(a, b)),
  );

  function single(header: string, sorted: Task[]): ListGroup[] {
    return sorted.length === 0 ? [] : [{ key: header, header, category: null, tasks: sorted }];
  }
}

function sentence(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** Ascending, with no-date last. */
function byDueAscending(a: Task, b: Task): number {
  if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

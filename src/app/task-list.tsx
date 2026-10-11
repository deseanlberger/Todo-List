"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { setTaskDone } from "@/app/actions";
import { Content, Header, IconButton, SettingsGear } from "@/components/chrome";
import { QuickAddButton } from "@/components/quick-add";
import { TaskRow } from "@/components/task-row";
import { EmptyState, Group } from "@/components/ui";
import { CATEGORY_ORDER, LIST_LABELS } from "@/lib/domain/categories";
import type { Task, TaskCategory } from "@/lib/domain/types";

/**
 * The whole app: a list of what is left to do.
 *
 * It used to be a scheduler — categories that set block lengths, a week
 * template of windows, an engine that proposed a week for approval. Desean
 * asked for a task manager and got a planning system, and said so. The
 * machinery is gone.
 *
 * What survived is the grouping, because he does it himself: his reminders
 * live in lists called Deep Focus, Deep Admin, Multitasking Admin, Personal
 * and Delegate, and those headers are his own filing read back to him
 * rather than a scheme this app invented.
 */

interface ListGroup {
  category: TaskCategory | null;
  header: string;
  tasks: Task[];
}

export function TaskList({
  tasks,
  timeZone,
  today,
}: {
  tasks: Task[];
  timeZone: string;
  today: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [, startTransition] = useTransition();

  const [optimistic, applyDone] = useOptimistic(
    tasks,
    (current: Task[], edit: { id: string; done: boolean }) =>
      current.map((task) =>
        task.id === edit.id
          ? { ...task, status: edit.done ? ("done" as const) : ("backlog" as const) }
          : task,
      ),
  );

  const toggleDone = (task: Task, done: boolean) => {
    startTransition(async () => {
      applyDone({ id: task.id, done });
      await setTaskDone(task.id, done);
    });
  };

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return optimistic;
    return optimistic.filter(
      (task) =>
        task.title.toLowerCase().includes(needle) ||
        (task.notes ?? "").toLowerCase().includes(needle),
    );
  }, [optimistic, query]);

  const open = matching.filter((task) => task.status !== "done");
  const done = matching.filter((task) => task.status === "done");

  const groups = useMemo(() => groupByCategory(open), [open]);

  return (
    <>
      <Header
        badge
        title="Tasks"
        subtitle={open.length === 0 ? "Nothing left" : `${open.length} to do`}
        trailing={
          <>
            <IconButton
              label={searching ? "Close search" : "Search"}
              onClick={() => {
                setSearching((was) => !was);
                setQuery("");
              }}
            >
              {searching ? <X size={22} /> : <Search size={22} />}
            </IconButton>
            <QuickAddButton />
            <IconButton label="Add a task" onClick={() => router.push("/tasks/new")}>
              <Plus size={25} strokeWidth={2.4} />
            </IconButton>
            <SettingsGear />
          </>
        }
      />

      <Content>
        {searching ? (
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="t-body mb-4 w-full rounded-[10px] px-3 py-2.5 outline-none"
            style={{ background: "var(--card)", border: "1px solid var(--separator)" }}
          />
        ) : null}

        {open.length === 0 && done.length === 0 ? (
          <EmptyState
            title={query ? "Nothing matches" : "Nothing to do"}
            detail={
              query
                ? "No task has those words in its title or notes."
                : "Reminders from your Mac land here, or tap + to add one."
            }
          />
        ) : null}

        {groups.map((group) => (
          <section key={group.header} className="mb-6">
            <div className="ios-group-header">
              <span className="flex items-center gap-2">
                <span>{group.header}</span>
                <span style={{ color: "var(--label-3)" }}>{group.tasks.length}</span>
              </span>
            </div>
            <Group>
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  timeZone={timeZone}
                  urgent={isDueSoon(task, today)}
                  onToggleDone={(value) => toggleDone(task, value)}
                  onOpen={() => router.push(`/tasks/${task.id}`)}
                  showCategory={false}
                />
              ))}
            </Group>
          </section>
        ))}

        {done.length > 0 ? (
          <section className="mb-6">
            <button
              type="button"
              onClick={() => setShowDone((was) => !was)}
              className="ios-group-header pressable w-full text-left"
            >
              {showDone ? "Hide" : "Show"} {done.length} done
            </button>
            {showDone ? (
              <Group>
                {done.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    timeZone={timeZone}
                    urgent={false}
                      onToggleDone={(value) => toggleDone(task, value)}
                    onOpen={() => router.push(`/tasks/${task.id}`)}
                  />
                ))}
              </Group>
            ) : null}
          </section>
        ) : null}
      </Content>
    </>
  );
}

/**
 * His own lists, in a fixed order, with anything unsorted last.
 *
 * Fixed rather than by-count so the list does not reshuffle under him as he
 * ticks things off — a group jumping position between two glances is how a
 * list stops being somewhere you can find things.
 */
function groupByCategory(tasks: Task[]): ListGroup[] {
  const groups: ListGroup[] = [];

  const unsorted = tasks.filter((task) => task.needsCategory);
  if (unsorted.length > 0) {
    groups.push({ category: null, header: "Needs a home", tasks: byDue(unsorted) });
  }

  for (const category of CATEGORY_ORDER) {
    const inGroup = tasks.filter((task) => !task.needsCategory && task.category === category);
    if (inGroup.length > 0) {
      groups.push({ category, header: LIST_LABELS[category], tasks: byDue(inGroup) });
    }
  }

  return groups;
}

/** Soonest first. No due date is not urgent, so it sits at the bottom. */
function byDue(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** Today or overdue. Drives the red on the row. */
function isDueSoon(task: Task, today: string): boolean {
  if (!task.dueDate || task.status === "done") return false;
  return task.dueDate.slice(0, 10) <= today;
}

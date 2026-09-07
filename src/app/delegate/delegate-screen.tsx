"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { assignTask, setHandedOff } from "@/app/actions";
import { ActionBar, Content, Header, StatusBar, TabBar } from "@/components/chrome";
import { EmptyState, PrimaryButton } from "@/components/ui";
import { formatDueLabel } from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";

/** The coaches items usually go to. Free text, so this is a shortcut list. */
const ROSTER = ["Annie", "Jake", "Ty", "Matthew", "Michael", "Megan", "D'Lainey"];

export function DelegateScreen({
  tasks,
  clock,
  timeZone,
  blockLabel,
}: {
  tasks: Task[];
  clock: string;
  timeZone: string;
  blockLabel: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = useMemo(() => {
    const byPerson = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = task.assignee?.trim() || "UNASSIGNED";
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(task);
    }
    return [...byPerson.entries()]
      .sort(([a], [b]) =>
        a === "UNASSIGNED" ? 1 : b === "UNASSIGNED" ? -1 : a.localeCompare(b),
      )
      .map(([name, items]) => ({ name, items }));
  }, [tasks]);

  const toggle = (task: Task) => {
    if (task.handedOffAt) return;
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
  };

  const markHandedOff = () => {
    startTransition(async () => {
      await Promise.all([...checked].map((id) => setHandedOff(id, true)));
      setChecked(new Set());
      router.refresh();
    });
  };

  const outstanding = tasks.filter((task) => !task.handedOffAt).length;

  return (
    <>
      <StatusBar clock={clock} />
      <Header eyebrow={blockLabel} title="DELEGATE" />

      <Content>
        {groups.length === 0 ? (
          <EmptyState>
            Nothing to hand off. Delegate items never claim calendar time of their own.
          </EmptyState>
        ) : null}

        {groups.map((group) => {
          const unassigned = group.name === "UNASSIGNED";
          return (
            <section key={group.name} className="mb-4">
              <div className="mb-2 flex items-center gap-2.5">
                {unassigned ? null : (
                  <span
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
                    style={{ border: "1px solid var(--antique-gold)" }}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 13,
                        color: "var(--antique-gold)",
                      }}
                    >
                      {group.name.charAt(0).toUpperCase()}
                    </span>
                  </span>
                )}
                <span
                  className="t-day shrink-0"
                  style={{
                    fontSize: 19,
                    color: unassigned ? "var(--text-faded)" : "var(--text)",
                  }}
                >
                  {group.name.toUpperCase()}
                </span>
                <span className="h-px flex-1 bg-hairline" />
                <span className="t-meta shrink-0 text-text-faded">{group.items.length}</span>
              </div>

              {group.items.map((task) => {
                const handed = Boolean(task.handedOffAt);
                const isChecked = checked.has(task.id);
                return (
                  <div key={task.id}>
                    <button
                      type="button"
                      onClick={() =>
                        unassigned ? setAssigning(assigning === task.id ? null : task.id) : toggle(task)
                      }
                      className="press mb-1.5 flex w-full items-center gap-[11px] rounded-[2px] px-3 py-[10px]"
                      style={{
                        background: "var(--panel)",
                        border: unassigned
                          ? "1px dashed var(--hairline)"
                          : "1px solid var(--hairline)",
                        opacity: handed ? 0.5 : 1,
                      }}
                    >
                      {unassigned ? (
                        <span
                          className="flex h-[15px] w-[15px] shrink-0 items-center justify-center"
                          style={{ color: "var(--gold-text)" }}
                          aria-hidden="true"
                        >
                          <Plus size={14} strokeWidth={1.5} />
                        </span>
                      ) : (
                        <span
                          className="flex h-[15px] w-[15px] shrink-0 items-center justify-center"
                          style={{
                            border: handed
                              ? "1px solid var(--positive)"
                              : `1px solid ${isChecked ? "var(--gold)" : "var(--text-faded)"}`,
                            background: isChecked ? "var(--gold)" : "transparent",
                          }}
                          aria-hidden="true"
                        >
                          {handed ? (
                            <Check size={11} strokeWidth={2} color="var(--positive)" />
                          ) : isChecked ? (
                            <Check size={11} strokeWidth={2} color="#000" />
                          ) : null}
                        </span>
                      )}

                      <span
                        className="t-title min-w-0 flex-1 truncate"
                        style={{
                          fontSize: 14,
                          textDecoration: handed ? "line-through" : undefined,
                          textDecorationColor: "var(--text-faded)",
                        }}
                      >
                        {task.title}
                      </span>

                      <span className="t-meta shrink-0 text-text-faded">
                        {handed
                          ? "HANDED"
                          : task.dueDate
                            ? formatDueLabel(task.dueDate, timeZone)
                            : "—"}
                      </span>
                    </button>

                    {assigning === task.id ? (
                      <div className="mb-2 flex flex-wrap gap-1.5 pl-7">
                        {ROSTER.map((person) => (
                          <button
                            key={person}
                            type="button"
                            onClick={() =>
                              startTransition(async () => {
                                await assignTask(task.id, person);
                                setAssigning(null);
                                router.refresh();
                              })
                            }
                            className="press t-cat rounded-[2px] px-2.5 py-[6px]"
                            style={{
                              border: "1px solid var(--hairline)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {person.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          );
        })}
        <div className="h-2" />
      </Content>

      {outstanding > 0 ? (
        <ActionBar>
          <PrimaryButton
            label={`MARK ${checked.size} HANDED OFF`}
            disabled={checked.size === 0}
            pending={pending}
            onClick={markHandedOff}
          />
        </ActionBar>
      ) : null}

      <TabBar />
    </>
  );
}

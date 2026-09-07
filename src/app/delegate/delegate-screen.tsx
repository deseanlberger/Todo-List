"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { assignTask, setHandedOff } from "@/app/actions";
import { ActionBar, Content, Header, SettingsGear, TabBar } from "@/components/chrome";
import { Button, EmptyState, Group } from "@/components/ui";
import { formatDueShort } from "@/lib/domain/time";
import type { Task } from "@/lib/domain/types";

/** The coaches items usually go to. Free text, so this is just a shortcut. */
const ROSTER = ["Annie", "Jake", "Ty", "Matthew", "Michael", "Megan", "D'Lainey"];

export function DelegateScreen({
  tasks,
  timeZone,
  blockLabel,
}: {
  tasks: Task[];
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
      const key = task.assignee?.trim() || "Unassigned";
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(task);
    }
    return [...byPerson.entries()]
      .sort(([a], [b]) =>
        a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b),
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
      <Header
        title="Delegate"
        subtitle={blockLabel}
        trailing={
          <div className="-mr-2">
            <SettingsGear />
          </div>
        }
      />

      <Content>
        {groups.length === 0 ? (
          <EmptyState
            title="Nothing to hand off"
            detail="Delegate items never claim calendar time of their own."
          />
        ) : null}

        {groups.map((group) => {
          const unassigned = group.name === "Unassigned";
          return (
            <Group
              key={group.name}
              header={
                <span className="flex items-center gap-2">
                  {unassigned ? null : <Avatar name={group.name} />}
                  {group.name}
                  <span style={{ color: "var(--label-3)" }}>{group.items.length}</span>
                </span>
              }
            >
              {group.items.map((task) => {
                const handed = Boolean(task.handedOffAt);
                const isChecked = checked.has(task.id);
                return (
                  <div key={task.id}>
                    <button
                      type="button"
                      onClick={() =>
                        unassigned
                          ? setAssigning(assigning === task.id ? null : task.id)
                          : toggle(task)
                      }
                      className="ios-row ios-row-inset pressable w-full"
                      style={{ opacity: handed ? 0.45 : 1 }}
                    >
                      {unassigned ? (
                        <Plus
                          size={20}
                          strokeWidth={2.2}
                          className="shrink-0"
                          style={{ color: "var(--blue)" }}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                          style={{
                            border: isChecked || handed ? "none" : "1.5px solid var(--label-3)",
                            background: handed
                              ? "var(--green)"
                              : isChecked
                                ? "var(--blue)"
                                : "transparent",
                          }}
                        >
                          {handed || isChecked ? (
                            <Check size={14} strokeWidth={3} color="#fff" />
                          ) : null}
                        </span>
                      )}

                      <span
                        className="t-body min-w-0 flex-1 truncate"
                        style={{ textDecoration: handed ? "line-through" : undefined }}
                      >
                        {task.title}
                      </span>

                      <span className="t-subhead shrink-0" style={{ color: "var(--label-2)" }}>
                        {handed
                          ? "Handed"
                          : task.dueDate
                            ? formatDueShort(task.dueDate, timeZone)
                            : ""}
                      </span>
                    </button>

                    {assigning === task.id ? (
                      <div className="flex flex-wrap gap-2 px-4 pt-1 pb-3">
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
                            className="pressable-solid t-subhead rounded-full px-3 py-1.5"
                            style={{ background: "var(--fill)", color: "var(--blue)" }}
                          >
                            {person}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </Group>
          );
        })}
      </Content>

      {outstanding > 0 ? (
        <ActionBar>
          <Button
            label={
              checked.size === 0
                ? "Select items to hand off"
                : `Mark ${checked.size} handed off`
            }
            kind="filled"
            full
            disabled={checked.size === 0 || pending}
            onClick={markHandedOff}
          />
        </ActionBar>
      ) : null}

      <TabBar />
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[22px] w-[22px] items-center justify-center rounded-full"
      style={{ background: "var(--fill)" }}
    >
      <span className="t-caption2" style={{ color: "var(--label-2)", fontWeight: 600 }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </span>
  );
}

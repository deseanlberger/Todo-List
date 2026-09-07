"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { createTask, deleteTask, patchTask } from "@/app/actions";
import { Content } from "@/components/chrome";
import { NavBar } from "@/components/nav-bar";
import {
  Button,
  Dot,
  Group,
  Row,
  RowValue,
  Segmented,
  Stars,
  Switch,
  categoryColor,
} from "@/components/ui";
import { CATEGORIES, CATEGORY_ORDER, categoryMeta } from "@/lib/domain/categories";
import {
  describeRule,
  formatRule,
  parseRule,
  type Frequency,
} from "@/lib/domain/recurrence";
import { WEEKDAY_SHORT } from "@/lib/domain/time";
import { urgencyLabel } from "@/lib/domain/priority";
import type { EstimationSample, Task, TaskCategory, TaskLocation } from "@/lib/domain/types";

const MAX_BLOCKS = 4;

export function TaskForm({
  task,
  nowIso,
  history,
}: {
  /** Null when creating. */
  task: Task | null;
  nowIso: string;
  history: EstimationSample[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickingCategory, setPickingCategory] = useState(false);

  const [title, setTitle] = useState(task?.title ?? "");
  const [category, setCategory] = useState<TaskCategory>(
    task?.category ?? "high_priority_admin",
  );
  const [location, setLocation] = useState<TaskLocation>(task?.location ?? "home");
  const [blocks, setBlocks] = useState(task?.estimatedBlocks ?? 1);
  const [impact, setImpact] = useState(task?.financialImpact ?? 3);
  const [due, setDue] = useState(task?.dueDate ? toLocalInput(task.dueDate) : "");
  const [recurring, setRecurring] = useState(task?.isRecurring ?? false);
  const stored = parseRule(task?.recurrenceRule ?? null);
  const [frequency, setFrequency] = useState<Frequency>(stored?.frequency ?? "weekly");
  const [weekdays, setWeekdays] = useState<number[]>(stored?.weekdays ?? []);
  const [assignee, setAssignee] = useState(task?.assignee ?? "");

  const meta = categoryMeta(category);
  const urgency = task
    ? urgencyLabel(
        { ...task, dueDate: due ? new Date(due).toISOString() : null },
        new Date(nowIso),
      )
    : null;

  const relevant = history.filter((sample) => sample.category === category).slice(0, 3);

  const save = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const dueIso = due ? new Date(due).toISOString() : null;
      // The rule only means anything when the task repeats, and the month
      // and year cases read their date off the due date rather than asking
      // for it twice.
      const rule = recurring
        ? formatRule({
            frequency,
            weekdays: frequency === "weekly" ? weekdays : [],
            monthDay: due ? Number(due.slice(8, 10)) : undefined,
            month: due ? Number(due.slice(5, 7)) : undefined,
          })
        : null;

      const payload = {
        title: title.trim(),
        category,
        location,
        estimatedBlocks: meta.schedules ? blocks : 1,
        financialImpact: impact,
        dueDate: dueIso,
        assignee: category === "delegate" ? assignee.trim() || null : null,
      };

      if (task) {
        await patchTask(task.id, {
          ...payload,
          isRecurring: recurring,
          recurrenceRule: rule,
        });
      } else {
        await createTask({
          ...payload,
          notes: null,
          isRecurring: recurring,
          recurrenceRule: rule,
        });
      }
      router.push("/tasks");
      router.refresh();
    });
  };

  const remove = () => {
    if (!task) return;
    startTransition(async () => {
      await deleteTask(task.id);
      router.push("/tasks");
      router.refresh();
    });
  };

  return (
    <>
      <NavBar
        title={task ? "Task" : "New task"}
        backLabel="Cancel"
        trailing={
          <button
            type="button"
            onClick={save}
            disabled={!title.trim() || pending}
            className="pressable-solid t-headline rounded-lg px-2 py-1 disabled:opacity-40"
            style={{ color: "var(--blue)" }}
          >
            {pending ? "Saving…" : task ? "Done" : "Add"}
          </button>
        }
      />

      <Content className="pt-4">
        <Group footer={task?.captureTranscript ? undefined : "What needs doing?"}>
          <div className="ios-row" style={{ paddingTop: 13, paddingBottom: 13 }}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title"
              aria-label="Task title"
              autoFocus={!task}
              className="t-body w-full bg-transparent outline-none"
              style={{ color: "var(--label)" }}
            />
          </div>
          {urgency ? (
            <div className="ios-row">
              <span className="t-subhead" style={{ color: "var(--red)" }}>
                {sentence(urgency)}
              </span>
            </div>
          ) : null}
          {task?.captureTranscript ? (
            <div className="ios-row" style={{ alignItems: "flex-start" }}>
              <span className="t-footnote" style={{ color: "var(--label-2)" }}>
                Captured by {task.captureSource === "telegram_voice" ? "voice" : "text"}.
                &ldquo;{task.captureTranscript}&rdquo;
              </span>
            </div>
          ) : null}
        </Group>

        <Group>
          <Row onClick={() => setPickingCategory((value) => !value)} chevron>
            <span className="t-body flex-1">Category</span>
            <Dot color={categoryColor(category)} />
            <RowValue>{sentence(CATEGORIES[category].label)}</RowValue>
          </Row>

          {pickingCategory
            ? CATEGORY_ORDER.map((option) => (
                <Row
                  key={option}
                  inset
                  onClick={() => {
                    setCategory(option);
                    setPickingCategory(false);
                    if (!CATEGORIES[option].schedules) setBlocks(1);
                  }}
                >
                  <Dot color={categoryColor(option)} />
                  <span className="t-body flex-1">{sentence(CATEGORIES[option].label)}</span>
                  {option === category ? (
                    <Check size={20} strokeWidth={2.5} style={{ color: "var(--blue)" }} />
                  ) : null}
                </Row>
              ))
            : null}

          <Row>
            <span className="t-body flex-1">Location</span>
            <Segmented
              ariaLabel="Location"
              className="w-[150px]"
              value={location}
              options={[
                { value: "home" as const, label: "Home" },
                { value: "gym" as const, label: "Gym" },
              ]}
              onChange={setLocation}
            />
          </Row>

          {meta.schedules ? (
            <Row>
              <span className="t-body flex-1">Blocks</span>
              <span className="t-subhead tnum" style={{ color: "var(--label-2)" }}>
                {blocks * meta.blockMinutes!} min
              </span>
              <Segmented
                ariaLabel="Estimated blocks"
                className="w-[132px]"
                value={String(blocks)}
                options={Array.from({ length: MAX_BLOCKS }, (_, index) => ({
                  value: String(index + 1),
                  label: String(index + 1),
                }))}
                onChange={(value) => setBlocks(Number(value))}
              />
            </Row>
          ) : null}

          {category === "delegate" ? (
            <Row>
              <span className="t-body flex-1">Assignee</span>
              <input
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                placeholder="Who?"
                aria-label="Assignee"
                className="t-body w-[140px] bg-transparent text-right outline-none"
                style={{ color: "var(--label-2)" }}
              />
            </Row>
          ) : null}
        </Group>

        <Group footer="Anything due inside 48 hours is treated as urgent.">
          <Row>
            <span className="t-body flex-1">Due</span>
            <input
              type="datetime-local"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              aria-label="Due date"
              className="t-body tnum bg-transparent text-right outline-none"
              style={{ color: "var(--label-2)" }}
            />
          </Row>

          <Row>
            <span className="t-body flex-1">Importance</span>
            <Stars value={impact} onChange={setImpact} />
          </Row>

          <Row>
            <span className="t-body flex-1">Repeats</span>
            <Switch checked={recurring} onChange={setRecurring} ariaLabel="Repeats" />
          </Row>

          {recurring ? (
            <>
              <Row inset>
                <Segmented
                  ariaLabel="How often"
                  className="flex-1"
                  value={frequency}
                  options={[
                    { value: "daily" as Frequency, label: "Day" },
                    { value: "weekly" as Frequency, label: "Week" },
                    { value: "monthly" as Frequency, label: "Month" },
                    { value: "yearly" as Frequency, label: "Year" },
                  ]}
                  onChange={setFrequency}
                />
              </Row>

              {frequency === "weekly" ? (
                <Row inset>
                  <div className="flex flex-1 gap-1">
                    {WEEKDAY_SHORT.map((label, day) => {
                      const on = weekdays.includes(day);
                      return (
                        <button
                          key={label}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={label}
                          onClick={() =>
                            setWeekdays((current) =>
                              on
                                ? current.filter((d) => d !== day)
                                : [...current, day].sort((a, b) => a - b),
                            )
                          }
                          className="t-footnote flex h-9 flex-1 items-center justify-center rounded-full"
                          style={{
                            background: on ? "var(--blue)" : "var(--fill)",
                            color: on ? "#fff" : "var(--label-2)",
                            fontWeight: on ? 600 : 400,
                          }}
                        >
                          {label[0]}
                        </button>
                      );
                    })}
                  </div>
                </Row>
              ) : null}

              <Row inset>
                <span className="t-footnote flex-1" style={{ color: "var(--label-2)" }}>
                  {due
                    ? summariseRepeat(frequency, weekdays, due)
                    : "Set a due date. That is the first one, and the repeat counts from it."}
                </span>
              </Row>
            </>
          ) : null}
        </Group>

        {task ? (
          <>
            <Group header="Estimator">
              <Row>
                <span className="t-body flex-1">Recent history</span>
                <RowValue>
                  {relevant.length === 0
                    ? "No completions yet"
                    : `est ${average(relevant.map((s) => s.estimatedBlocks))} / act ${average(
                        relevant.map((s) => s.actualBlocks),
                      )}`}
                </RowValue>
              </Row>
            </Group>

            <Group>
              <Row onClick={remove}>
                <Trash2 size={19} strokeWidth={2} style={{ color: "var(--red)" }} />
                <span className="t-body flex-1" style={{ color: "var(--red)" }}>
                  Delete task
                </span>
              </Row>
            </Group>
          </>
        ) : null}

        {task && category !== "delegate" ? (
          <Button
            label="Hand this off instead"
            full
            onClick={() => {
              setCategory("delegate");
              setBlocks(1);
            }}
          />
        ) : null}
      </Content>
    </>
  );
}

function sentence(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function average(values: number[]): string {
  if (values.length === 0) return "0";
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  return mean.toFixed(1).replace(/\.0$/, "");
}

/** `datetime-local` wants `YYYY-MM-DDTHH:MM` in the browser's own zone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/** "Every week on Mon, Wed. Next: Wed Sep 9." under the picker. */
function summariseRepeat(
  frequency: Frequency,
  weekdays: number[],
  due: string,
): string {
  const rule = formatRule({
    frequency,
    weekdays: frequency === "weekly" ? weekdays : [],
    monthDay: Number(due.slice(8, 10)),
    month: Number(due.slice(5, 7)),
  });

  const words = describeRule(rule);
  if (frequency === "weekly" && weekdays.length === 0) {
    return "Every week on the same weekday as the due date.";
  }
  return `${words}. The due date above is the first one.`;
}

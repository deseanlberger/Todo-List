"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { createTask, deleteTask, patchTask } from "@/app/actions";
import { ActionBar, Content, StatusBar } from "@/components/chrome";
import {
  Button,
  PrimaryButton,
  SegmentedToggle,
  categoryLabel,
  labelColor,
  railColor,
} from "@/components/ui";
import { CATEGORIES, CATEGORY_ORDER, categoryMeta } from "@/lib/domain/categories";
import { urgencyLabel } from "@/lib/domain/priority";
import { formatDueLabel } from "@/lib/domain/time";
import type { EstimationSample, Task, TaskCategory, TaskLocation } from "@/lib/domain/types";

const MAX_BLOCKS = 3;

export function TaskForm({
  task,
  clock,
  timeZone,
  nowIso,
  history,
}: {
  /** Null when creating. */
  task: Task | null;
  clock: string;
  timeZone: string;
  nowIso: string;
  history: EstimationSample[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickingCategory, setPickingCategory] = useState(false);

  const [title, setTitle] = useState(task?.title ?? "");
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? "high_priority_admin");
  const [location, setLocation] = useState<TaskLocation>(task?.location ?? "home");
  const [blocks, setBlocks] = useState(task?.estimatedBlocks ?? 1);
  const [impact, setImpact] = useState(task?.financialImpact ?? 3);
  const [due, setDue] = useState(task?.dueDate ? toLocalInput(task.dueDate) : "");
  const [recurring, setRecurring] = useState(task?.isRecurring ?? false);
  const [assignee, setAssignee] = useState(task?.assignee ?? "");

  const meta = categoryMeta(category);
  const now = new Date(nowIso);
  const urgency = task ? urgencyLabel({ ...task, dueDate: due ? new Date(due).toISOString() : null }, now) : null;

  const relevantHistory = history.filter((sample) => sample.category === category).slice(0, 3);

  const save = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const dueIso = due ? new Date(due).toISOString() : null;
      if (task) {
        await patchTask(task.id, {
          title: title.trim(),
          category,
          location,
          estimatedBlocks: meta.schedules ? blocks : 1,
          financialImpact: impact,
          dueDate: dueIso,
          isRecurring: recurring,
          assignee: category === "delegate" ? assignee.trim() || null : null,
        });
        router.push("/tasks");
      } else {
        await createTask({
          title: title.trim(),
          category,
          location,
          estimatedBlocks: blocks,
          financialImpact: impact,
          dueDate: dueIso,
          assignee: category === "delegate" ? assignee.trim() || null : null,
          notes: null,
        });
        router.push("/tasks");
      }
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
      <StatusBar clock={clock} />

      <header className="flex shrink-0 items-center justify-between px-[22px] pt-1.5 pb-3.5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-text-secondary"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <span className="t-eyebrow text-text-secondary">
          {task ? `TASK · #${task.id.slice(-4).toUpperCase()}` : "NEW TASK"}
        </span>
        {task ? (
          <button
            type="button"
            onClick={remove}
            aria-label="Delete this task"
            className="press -mr-2 flex h-11 w-11 items-center justify-center"
            style={{ color: "var(--urgent)" }}
          >
            <Trash2 size={18} strokeWidth={1.5} />
          </button>
        ) : (
          <span className="h-11 w-11" />
        )}
      </header>

      <Content>
        <div
          className="mb-4 rounded-[2px] p-3"
          style={{ background: "var(--card-navy)", border: "1px solid var(--antique-gold)" }}
        >
          {urgency ? (
            <div className="t-cat mb-2" style={{ color: "#C2453F", letterSpacing: "0.22em" }}>
              {urgency}
            </div>
          ) : null}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="WHAT IS IT?"
            aria-label="Task title"
            className="t-sheet-title w-full bg-transparent outline-none"
            style={{ color: "#FFFFFF" }}
          />
          {task?.captureTranscript ? (
            <p
              className="t-sub mt-2.5"
              style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.5 }}
            >
              Captured by {task.captureSource === "telegram_voice" ? "voice" : "text"}
              {". "}
              &ldquo;{task.captureTranscript}&rdquo;
            </p>
          ) : null}
        </div>

        <Row label="CATEGORY">
          <button
            type="button"
            onClick={() => setPickingCategory((value) => !value)}
            aria-expanded={pickingCategory}
            className="press flex items-center gap-2"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: railColor(category) }}
              aria-hidden="true"
            />
            <span className="t-cat" style={{ color: labelColor(category) }}>
              {categoryLabel(category)}
            </span>
            <ChevronRight size={14} strokeWidth={1.5} className="text-text-faded" />
          </button>
        </Row>

        {pickingCategory ? (
          <div className="flex flex-wrap gap-1.5 pb-3">
            {CATEGORY_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setCategory(option);
                  setPickingCategory(false);
                  if (!CATEGORIES[option].schedules) setBlocks(1);
                }}
                className="press t-cat rounded-[2px] px-2.5 py-[7px]"
                style={{
                  border: `1px solid ${option === category ? labelColor(option) : "var(--hairline)"}`,
                  color: labelColor(option),
                }}
              >
                {CATEGORIES[option].label}
              </button>
            ))}
          </div>
        ) : null}

        <Row label="LOCATION">
          <SegmentedToggle
            ariaLabel="Location"
            value={location}
            options={[
              { value: "home" as const, label: "HOME" },
              { value: "gym" as const, label: "GYM" },
            ]}
            onChange={setLocation}
          />
        </Row>

        {meta.schedules ? (
          <Row label="BLOCKS">
            <div className="flex items-center gap-2.5">
              <span className="t-meta text-text-secondary">
                EST {blocks * meta.blockMinutes!} MIN
              </span>
              <div className="flex gap-1">
                {Array.from({ length: MAX_BLOCKS }, (_, index) => index + 1).map((step) => (
                  <button
                    key={step}
                    type="button"
                    aria-label={`Set the estimate to ${step} block${step === 1 ? "" : "s"}`}
                    onClick={() => setBlocks(step)}
                    className="press h-[22px] w-[22px]"
                    style={{
                      background: step <= blocks ? railColor(category) : "transparent",
                      border: `1px solid ${step <= blocks ? railColor(category) : "var(--hairline)"}`,
                    }}
                  />
                ))}
              </div>
            </div>
          </Row>
        ) : null}

        {category === "delegate" ? (
          <Row label="ASSIGNEE">
            <input
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              placeholder="WHO?"
              aria-label="Assignee"
              className="t-meta-11 w-[120px] bg-transparent text-right text-text outline-none placeholder:text-text-faded"
            />
          </Row>
        ) : null}

        <Row label="DUE">
          <div className="flex items-center gap-2">
            {due ? (
              <span className="t-meta text-text-secondary">
                {formatDueLabel(new Date(due).toISOString(), timeZone)}
              </span>
            ) : null}
            <input
              type="datetime-local"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              aria-label="Due date"
              className="t-meta-11 bg-transparent text-right text-text outline-none"
            />
          </div>
        </Row>

        <Row label="FINANCIAL IMPACT">
          <div className="flex items-end gap-1">
            {[1, 2, 3, 4, 5].map((step) => (
              <button
                key={step}
                type="button"
                aria-label={`Set financial impact to ${step}`}
                onClick={() => setImpact(step)}
                className="press h-5 w-[14px]"
                style={{
                  background: step <= impact ? "var(--antique-gold)" : "transparent",
                  border: `1px solid ${step <= impact ? "var(--antique-gold)" : "var(--hairline)"}`,
                }}
              />
            ))}
          </div>
        </Row>

        <Row label="RECURRING">
          <button
            type="button"
            role="switch"
            aria-checked={recurring}
            aria-label="Recurring"
            onClick={() => setRecurring((value) => !value)}
            className="press relative h-[22px] w-[42px] rounded-[2px]"
            style={{
              border: "1px solid var(--hairline)",
              background: recurring ? "var(--gold)" : "transparent",
            }}
          >
            <span
              className="absolute top-[2px] h-4 w-4"
              style={{
                left: recurring ? 23 : 2,
                background: recurring ? "#000" : "var(--text-faded)",
                transition: "left 200ms var(--ease-default)",
              }}
            />
          </button>
        </Row>

        <div className="flex items-center justify-between border-t border-hairline py-[14px]">
          <span className="t-section text-text-faded">ESTIMATOR HISTORY</span>
          <span className="t-meta text-text-secondary">
            {relevantHistory.length === 0
              ? "NO COMPLETIONS YET"
              : `LAST ${relevantHistory.length} · EST ${average(
                  relevantHistory.map((s) => s.estimatedBlocks),
                )} / ACT ${average(relevantHistory.map((s) => s.actualBlocks))}`}
          </span>
        </div>
        <div className="h-3" />
      </Content>

      <ActionBar>
        <div className="flex gap-2">
          {task && category !== "delegate" ? (
            <Button
              label="DELEGATE IT"
              className="flex-1"
              onClick={() => {
                setCategory("delegate");
                setBlocks(1);
              }}
            />
          ) : null}
          <div style={{ flex: 1.4 }}>
            <PrimaryButton
              label={task ? "SAVE" : "CREATE TASK"}
              pending={pending}
              disabled={!title.trim()}
              onClick={save}
            />
          </div>
        </div>
      </ActionBar>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-hairline py-[14px]">
      <span className="t-section shrink-0 text-text-faded">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function average(values: number[]): string {
  if (values.length === 0) return "0";
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  return mean.toFixed(1).replace(/\.0$/, "");
}

/** `datetime-local` wants `YYYY-MM-DDTHH:MM` in the browser's own zone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

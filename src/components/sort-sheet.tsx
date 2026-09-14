"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { categoriseTask } from "@/app/actions";
import { CATEGORIES, CATEGORY_ORDER, defaultBlocks } from "@/lib/domain/categories";
import type { Task, TaskCategory } from "@/lib/domain/types";
import { Button, Dot, Group, Row, categoryColor } from "@/components/ui";

/**
 * "What kind of work is this?" — for a task that arrived from Reminders.
 *
 * Nothing was guessed on the way in, by design. Category decides block
 * length, which windows the task may sit in, and how it ranks, so a wrong
 * guess is worse than no guess: it would schedule confidently and wrongly.
 */
export function SortSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const sort = (category: TaskCategory) => {
    startTransition(async () => {
      await categoriseTask(task.id, category);
      router.refresh();
      onClose();
    });
  };

  return (
    <div
      role="dialog"
      aria-label={`Sort ${task.title}`}
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.35)" }}
      />

      <div
        className="sheet-enter relative max-h-[85dvh] overflow-y-auto rounded-t-[14px] px-4 pt-4 pb-8"
        style={{ background: "var(--bg)" }}
      >
        <p className="t-headline mb-0.5 text-center">{task.title}</p>
        <p className="t-footnote mb-4 text-center" style={{ color: "var(--label-2)" }}>
          From Reminders. What kind of work is it?
        </p>

        <Group footer="Nothing gets scheduled until it has a category, because the category is what decides how long it takes and where it can go.">
          {CATEGORY_ORDER.map((category) => {
            const meta = CATEGORIES[category];
            return (
              <Row key={category} onClick={() => sort(category)}>
                <Dot color={categoryColor(category)} />
                <span className="t-body flex-1">{sentence(meta.label)}</span>
                <span className="t-footnote" style={{ color: "var(--label-2)" }}>
                  {meta.schedules
                    ? `${defaultBlocks(category)} × ${meta.blockMinutes} min`
                    : "No calendar time"}
                </span>
              </Row>
            );
          })}
        </Group>

        <Button label="Not now" kind="plain" full onClick={onClose} disabled={pending} />
      </div>
    </div>
  );
}

function sentence(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

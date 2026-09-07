"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { saveCommitments } from "@/app/actions";
import { ActionBar, Content } from "@/components/chrome";
import { NavBar } from "@/components/nav-bar";
import { Button, Group, Row, RowValue } from "@/components/ui";
import { WEEKDAY_FULL, formatClock, parseClock } from "@/lib/domain/time";
import type { TaskLocation } from "@/lib/domain/types";

export interface EditorCommitment {
  id: string;
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location: TaskLocation;
  sortOrder: number;
}

export function CommitmentsEditor({ initial }: { initial: EditorCommitment[] }) {
  const router = useRouter();
  const [items, setItems] = useState<EditorCommitment[]>(initial);
  const [openDay, setOpenDay] = useState<number | null>(
    initial.length > 0 ? initial[0].weekday : 0,
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const weeklyMinutes = useMemo(
    () =>
      items.reduce(
        (total, item) => total + Math.max(0, parseClock(item.endTime) - parseClock(item.startTime)),
        0,
      ),
    [items],
  );

  const touch = () => setSaved(false);

  const patch = (id: string, change: Partial<EditorCommitment>) => {
    touch();
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  };

  const remove = (id: string) => {
    touch();
    setItems((current) => current.filter((item) => item.id !== id));
    if (editing === id) setEditing(null);
  };

  const add = (weekday: number) => {
    touch();
    const id = `new-${weekday}-${Date.now()}`;
    setItems((current) => [
      ...current,
      {
        id,
        title: "",
        weekday,
        startTime: "15:00",
        endTime: "17:00",
        location: "gym",
        sortOrder: current.filter((item) => item.weekday === weekday).length,
      },
    ]);
    // Open the new one straight away — it has no title yet, so there is
    // nothing to read until it is filled in.
    setEditing(id);
  };

  const save = () => {
    startTransition(async () => {
      await saveCommitments(
        items
          .filter(
            (item) =>
              item.title.trim() !== "" &&
              parseClock(item.endTime) > parseClock(item.startTime),
          )
          .map((item, index) => ({
            id: item.id.startsWith("new-") ? undefined : item.id,
            title: item.title.trim(),
            weekday: item.weekday,
            startTime: formatClock(parseClock(item.startTime)),
            endTime: formatClock(parseClock(item.endTime)),
            location: item.location,
            sortOrder: index,
          })),
      );
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <>
      <NavBar title="Weekly commitments" backLabel="Settings" />

      <Content className="pt-4">
        <Group footer="The things you already do at the same time every week: coaching a group, a standing meeting, a lift. Nothing gets scheduled over one.">
          <Row>
            <span className="t-body flex-1">Booked every week</span>
            <span className="t-headline tnum" style={{ color: "var(--blue)" }}>
              {formatHours(weeklyMinutes)}
            </span>
          </Row>
        </Group>

        <Group footer="Tap a day to open it. A gym commitment also keeps Home work out of the time around it.">
          {WEEKDAY_FULL.map((label, weekday) => {
            const dayItems = items
              .filter((item) => item.weekday === weekday)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const isOpen = openDay === weekday;

            return (
              <div key={label}>
                <Row onClick={() => setOpenDay(isOpen ? null : weekday)}>
                  <span className="t-body flex-1" style={{ fontWeight: isOpen ? 600 : 400 }}>
                    {label}
                  </span>
                  <RowValue>
                    {dayItems.length === 0
                      ? "Nothing"
                      : `${dayItems.length} ${dayItems.length === 1 ? "thing" : "things"}`}
                  </RowValue>
                  {isOpen ? (
                    <ChevronDown size={17} strokeWidth={2.5} style={{ color: "var(--label-3)" }} />
                  ) : (
                    <ChevronRight size={17} strokeWidth={2.5} style={{ color: "var(--label-3)" }} />
                  )}
                </Row>

                {isOpen
                  ? dayItems.map((item) => {
                      const open = editing === item.id;

                      return (
                        <div key={item.id}>
                          <Row inset>
                            <button
                              type="button"
                              onClick={() => setEditing(open ? null : item.id)}
                              aria-expanded={open}
                              className="min-w-0 flex-1 text-left"
                              style={{ color: open ? "var(--blue)" : "var(--label)" }}
                            >
                              <span className="t-body block truncate">
                                {item.title.trim() === "" ? "Untitled" : item.title}
                              </span>
                              <span
                                className="t-footnote tnum block"
                                style={{ color: "var(--label-2)" }}
                              >
                                {to12(item.startTime)} – {to12(item.endTime)}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                patch(item.id, {
                                  location: item.location === "gym" ? "home" : "gym",
                                })
                              }
                              aria-label={`${item.title || "Commitment"} is at ${item.location}`}
                              className="pressable-solid t-footnote shrink-0 rounded-full px-2.5 py-1"
                              style={{
                                background: "var(--fill)",
                                color:
                                  item.location === "gym"
                                    ? "var(--cat-deep-focus)"
                                    : "var(--label-2)",
                                fontWeight: 500,
                              }}
                            >
                              {item.location === "gym" ? "Gym" : "Home"}
                            </button>

                            <button
                              type="button"
                              aria-label="Delete this commitment"
                              onClick={() => remove(item.id)}
                              className="pressable -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                              style={{ color: "var(--red)" }}
                            >
                              <Trash2 size={16} strokeWidth={2} />
                            </button>
                          </Row>

                          {open ? (
                            <>
                              <Row inset>
                                <input
                                  autoFocus={item.title === ""}
                                  aria-label="What is it"
                                  placeholder="Flight Academy"
                                  value={item.title}
                                  onChange={(event) =>
                                    patch(item.id, { title: event.target.value })
                                  }
                                  className="t-body w-full rounded-[8px] px-2 py-1.5 outline-none"
                                  style={{ background: "var(--fill)" }}
                                />
                              </Row>
                              <Row inset>
                                <input
                                  type="time"
                                  aria-label="Starts"
                                  value={item.startTime}
                                  onChange={(event) =>
                                    patch(item.id, { startTime: event.target.value })
                                  }
                                  className="t-body tnum flex-1 rounded-[8px] px-2 py-1.5 outline-none"
                                  style={{ background: "var(--fill)" }}
                                />
                                <span style={{ color: "var(--label-3)" }}>–</span>
                                <input
                                  type="time"
                                  aria-label="Ends"
                                  value={item.endTime}
                                  onChange={(event) =>
                                    patch(item.id, { endTime: event.target.value })
                                  }
                                  className="t-body tnum flex-1 rounded-[8px] px-2 py-1.5 outline-none"
                                  style={{ background: "var(--fill)" }}
                                />
                              </Row>
                              <Row inset>
                                <span
                                  className="t-footnote flex-1"
                                  style={{ color: "var(--label-2)" }}
                                >
                                  Moves to a different day?
                                </span>
                                <select
                                  aria-label="Day of the week"
                                  value={item.weekday}
                                  onChange={(event) => {
                                    patch(item.id, { weekday: Number(event.target.value) });
                                    setOpenDay(Number(event.target.value));
                                  }}
                                  className="t-body rounded-[8px] px-2 py-1.5 outline-none"
                                  style={{ background: "var(--fill)" }}
                                >
                                  {WEEKDAY_FULL.map((name, index) => (
                                    <option key={name} value={index}>
                                      {name}
                                    </option>
                                  ))}
                                </select>
                              </Row>
                            </>
                          ) : null}
                        </div>
                      );
                    })
                  : null}

                {isOpen ? (
                  <Row inset onClick={() => add(weekday)}>
                    <Plus size={19} strokeWidth={2.2} style={{ color: "var(--blue)" }} />
                    <span className="t-body flex-1" style={{ color: "var(--blue)" }}>
                      Add something
                    </span>
                  </Row>
                ) : null}
              </div>
            );
          })}
        </Group>

        <div className="ios-group-footer mb-6">
          Anything without a name is dropped on save. Changes show on the calendar right
          away; already-placed blocks move on the next Schedule my week.
        </div>
      </Content>

      <ActionBar>
        <Button
          label={pending ? "Saving…" : saved ? "Saved" : "Save commitments"}
          kind="filled"
          full
          disabled={pending}
          onClick={save}
        />
      </ActionBar>
    </>
  );
}

/** `7h 30m`, or `7h` on the hour. */
function formatHours(minutes: number): string {
  if (minutes <= 0) return "Nothing yet";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** `3:00 PM` from a 24-hour `HH:MM`. */
function to12(clock: string): string {
  const [hour24, minute] = clock.split(":").map(Number);
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${hour24 < 12 ? "AM" : "PM"}`;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Mic, Square } from "lucide-react";
import { captureTasks, type CapturedSummary } from "@/app/actions";
import { Button, Dot, Group, Row, categoryColor } from "@/components/ui";
import { CATEGORIES } from "@/lib/domain/categories";

/* -------------------------------------------------- Web Speech API typing
 * Safari exposes this prefixed and the DOM lib does not declare it, so the
 * shape used here is declared locally rather than cast away with `any`.
 */

interface SpeechResultAlternative {
  transcript: string;
}
interface SpeechResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechResultAlternative;
}
interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}
interface SpeechEvent {
  resultIndex: number;
  results: SpeechResultList;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function speechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ------------------------------------------------------------------ sheet */

export function QuickAddSheet({ onDismiss }: { onDismiss: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [captured, setCaptured] = useState<CapturedSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const supported = useRef<boolean>(false);

  useEffect(() => {
    supported.current = speechRecognition() !== null;
  }, []);

  const stop = useCallback(() => {
    recognition.current?.stop();
    recognition.current = null;
    setListening(false);
    setInterim("");
  }, []);

  // Never leave the microphone open behind a closed sheet.
  useEffect(() => stop, [stop]);

  const start = () => {
    const Ctor = speechRecognition();
    if (!Ctor) {
      setError("This browser can't do speech. Type it instead.");
      return;
    }

    setError(null);
    const engine = new Ctor();
    engine.lang = "en-US";
    engine.continuous = true;
    engine.interimResults = true;

    engine.onresult = (event) => {
      let finalText = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (finalText) setText((current) => (current + " " + finalText).trim());
      setInterim(pending);
    };

    engine.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone access is off. Allow it in Safari settings."
          : "Couldn't hear that. Try again or type it.",
      );
      stop();
    };

    engine.onend = () => setListening(false);

    recognition.current = engine;
    engine.start();
    setListening(true);
  };

  const save = async () => {
    const spoken = listening;
    stop();
    const body = text.trim();
    if (!body) return;

    setSaving(true);
    setError(null);
    try {
      const result = await captureTasks(body, spoken ? "voice" : "text");
      if (result.length === 0) {
        setError("Couldn't find a task in that.");
      } else {
        setCaptured(result);
        router.refresh();
      }
    } catch {
      setError("Saving failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="fade-enter absolute inset-0"
        style={{ background: "var(--scrim)" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick add"
        className="sheet-enter no-scrollbar relative max-h-[90%] overflow-y-auto px-4 pb-8"
        style={{
          background: "var(--bg)",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      >
        <div className="sticky top-0 z-10 pt-2 pb-3" style={{ background: "var(--bg)" }}>
          <div
            className="mx-auto mb-4 h-[5px] w-9 rounded-full"
            style={{ background: "var(--label-4)" }}
            aria-hidden="true"
          />
          <h2 className="t-title3">{captured ? "Captured" : "Quick add"}</h2>
          <p className="t-footnote mt-0.5" style={{ color: "var(--label-2)" }}>
            {captured
              ? "Tap one to change anything."
              : "Talk it out. Several tasks in one go is fine."}
          </p>
        </div>

        {captured ? (
          <>
            <Group>
              {captured.map((task) => (
                <Row key={task.id} href={`/tasks/${task.id}`} inset chevron>
                  <Dot color={categoryColor(task.category)} />
                  <span className="min-w-0 flex-1">
                    <span className="t-body block">{task.title}</span>
                    <span
                      className="t-footnote block"
                      style={{ color: "var(--label-2)" }}
                    >
                      {[
                        sentence(CATEGORIES[task.category].label),
                        task.location === "gym" ? "Gym" : "Home",
                        task.assignee ?? null,
                        CATEGORIES[task.category].schedules
                          ? `${task.estimatedBlocks} ${
                              task.estimatedBlocks === 1 ? "block" : "blocks"
                            }`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <Check size={18} strokeWidth={2.5} style={{ color: "var(--green)" }} />
                </Row>
              ))}
            </Group>

            <div className="flex gap-2">
              <Button
                label="Add another"
                kind="gray"
                className="flex-1"
                onClick={() => {
                  setCaptured(null);
                  setText("");
                }}
              />
              <Button label="Done" kind="filled" className="flex-1" onClick={onDismiss} />
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 flex flex-col items-center pt-3">
              <button
                type="button"
                onClick={listening ? stop : start}
                aria-label={listening ? "Stop listening" : "Start talking"}
                className="pressable-solid flex items-center justify-center rounded-full"
                style={{
                  width: 88,
                  height: 88,
                  background: listening ? "var(--red)" : "var(--blue)",
                  color: "#fff",
                  boxShadow: listening
                    ? "0 0 0 10px color-mix(in srgb, var(--red) 18%, transparent)"
                    : "none",
                  transition: "box-shadow 200ms ease-out, background-color 200ms ease-out",
                }}
              >
                {listening ? (
                  <Square size={30} strokeWidth={2} fill="#fff" />
                ) : (
                  <Mic size={36} strokeWidth={2} />
                )}
              </button>
              <p className="t-footnote mt-3" style={{ color: "var(--label-2)" }}>
                {listening ? "Listening. Tap to stop." : "Tap to talk"}
              </p>
            </div>

            <Group footer="Claude reads it and fills in the category, location, block estimate and due date. All editable after.">
              <div className="ios-row" style={{ alignItems: "flex-start", minHeight: 96 }}>
                <textarea
                  value={interim ? `${text} ${interim}`.trim() : text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Or type it here"
                  aria-label="What needs doing?"
                  rows={3}
                  className="t-body w-full resize-none bg-transparent outline-none"
                  style={{ color: interim ? "var(--label-2)" : "var(--label)" }}
                />
              </div>
            </Group>

            {error ? (
              <p className="t-footnote mb-3 px-4" style={{ color: "var(--red)" }}>
                {error}
              </p>
            ) : null}

            <Button
              label={saving ? "Reading it…" : "Add task"}
              kind="filled"
              full
              disabled={!text.trim() || saving}
              onClick={save}
            />

            <div className="mt-3 text-center">
              <Link
                href="/tasks/new"
                onClick={onDismiss}
                className="t-subhead"
                style={{ color: "var(--blue)" }}
              >
                Fill it in by hand instead
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function sentence(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/* ----------------------------------------------------------------- button */

/** The "+" that opens Quick Add. */
export function QuickAddButton({ size = 25 }: { size?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Quick add a task"
        onClick={() => setOpen(true)}
        className="pressable flex h-11 w-11 items-center justify-center rounded-full"
        style={{ color: "var(--blue)" }}
      >
        <Mic size={size} strokeWidth={2.2} />
      </button>
      {open ? <QuickAddSheet onDismiss={() => setOpen(false)} /> : null}
    </>
  );
}

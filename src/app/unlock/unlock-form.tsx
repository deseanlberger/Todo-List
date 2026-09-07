"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { unlock } from "./actions";

export function UnlockForm({ next }: { next: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim() || pending) return;

    startTransition(async () => {
      const result = await unlock(value);
      if (result.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      setWrong(true);
      setValue("");
    });
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-8">
      <div className="w-full max-w-[320px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "var(--fill)", color: "var(--label-2)" }}
          >
            <Lock size={24} strokeWidth={2} />
          </span>
          <h1 className="t-title2">Scheduler</h1>
          <p className="t-subhead mt-1" style={{ color: "var(--label-2)" }}>
            Enter your passcode
          </p>
        </div>

        <form onSubmit={submit}>
          <input
            autoFocus
            type="password"
            inputMode="text"
            autoComplete="current-password"
            aria-label="Passcode"
            aria-invalid={wrong}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setWrong(false);
            }}
            className="t-body w-full rounded-[10px] px-3 py-3 text-center outline-none"
            style={{
              background: "var(--card)",
              border: `1px solid ${wrong ? "var(--red)" : "var(--separator)"}`,
            }}
          />

          {/* Reserve the line so the button does not jump when it appears. */}
          <p
            role={wrong ? "alert" : undefined}
            className="t-footnote mt-2 mb-4 text-center"
            style={{ color: "var(--red)", minHeight: 18 }}
          >
            {wrong ? "That is not it. Try again." : ""}
          </p>

          <Button
            label={pending ? "Checking…" : "Unlock"}
            kind="filled"
            full
            type="submit"
            disabled={pending || value.trim() === ""}
          />
        </form>

        <p className="t-caption mt-6 text-center" style={{ color: "var(--label-3)" }}>
          This device stays unlocked for a year.
        </p>
      </div>
    </main>
  );
}

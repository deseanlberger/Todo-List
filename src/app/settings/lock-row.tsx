"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Row } from "@/components/ui";
import { lock } from "@/app/unlock/actions";

/** Sign this device out. Only rendered when a passcode is actually set. */
export function LockRow() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Row
      onClick={() =>
        startTransition(async () => {
          await lock();
          router.replace("/unlock");
          router.refresh();
        })
      }
    >
      <span className="t-body flex-1" style={{ color: "var(--red)" }}>
        {pending ? "Locking…" : "Lock this device"}
      </span>
    </Row>
  );
}

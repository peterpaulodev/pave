"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markSummarySeen } from "@/actions/summary";
import { Button } from "@/components/ui/button";

/** "Começar [mês]": confirms the summary was read, then goes back to the panel. */
export function StartMonthButton({
  period,
  monthLabel,
}: {
  period: string;
  monthLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className="min-h-11 w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await markSummarySeen(period);
          } catch {
            // Even if the write failed, go on: the panel skips its redirect
            // for `?summary=seen`, and the summary just shows again next visit.
          }
          router.push("/?summary=seen");
        })
      }
    >
      Começar {monthLabel}
    </Button>
  );
}

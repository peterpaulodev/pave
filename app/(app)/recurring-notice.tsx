"use client";

import { useSyncExternalStore } from "react";
import { readStorage, subscribeStorage, writeStorage } from "@/lib/safe-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Shown once per month (per period) until dismissed. If storage is
// unavailable the notice stays hidden rather than nagging on every visit.
function storageKey(period: string) {
  return `pave:recurring-notice:${period}`;
}

function storageWorks(): boolean {
  try {
    window.localStorage.getItem("pave:probe");
    return true;
  } catch {
    return false;
  }
}

export function RecurringNotice({ period }: { period: string }) {
  // Server snapshot is "dismissed" so nothing flashes before hydration.
  const dismissed = useSyncExternalStore(
    subscribeStorage,
    () => readStorage(storageKey(period)) !== null || !storageWorks(),
    () => true
  );

  if (dismissed) return null;

  function dismiss() {
    writeStorage(storageKey(period), "1");
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm">
          Suas contas fixas já entraram neste mês. “Fixa” marca o que entrou
          sozinho e “Agendado”, o que ainda vai vencer — esse dinheiro já está
          reservado.
        </p>
        <Button variant="outline" className="min-h-11 self-start" onClick={dismiss}>
          Entendi
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Shown once per month (per period) until dismissed. localStorage can throw
// or be empty (private window, blocked site data), so every access is
// wrapped and the notice simply stays hidden if storage is unavailable.
function storageKey(period: string) {
  return `pave:recurring-notice:${period}`;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function wasDismissed(period: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(period)) === "1";
  } catch {
    return true; // storage unavailable — keep the notice hidden
  }
}

export function RecurringNotice({ period }: { period: string }) {
  // Server snapshot is "dismissed" so nothing flashes before hydration.
  const dismissed = useSyncExternalStore(
    subscribe,
    () => wasDismissed(period),
    () => true
  );

  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey(period), "1");
    } catch {
      // ignore: it just may show again next visit
    }
    listeners.forEach((listener) => listener());
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

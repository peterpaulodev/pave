"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setReminderSettings } from "@/actions/push";
import { getPushCapability, type PushCapability } from "@/lib/push/client";
import { enableReminderOnThisDevice } from "@/lib/push/enable";
import { subscribeStorage } from "@/lib/safe-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const HOURS = [18, 19, 20, 21, 22, 23];

export function ReminderSettings({
  enabled,
  hour,
}: {
  enabled: boolean;
  hour: number;
}) {
  // "ready" before hydration keeps the server render neutral.
  const capability = useSyncExternalStore<PushCapability | "pending">(
    subscribeStorage,
    getPushCapability,
    () => "pending"
  );
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const hours = HOURS.includes(hour) ? HOURS : [...HOURS, hour].sort((a, b) => a - b);
  const blocked = capability === "denied" || capability === "needs-install" || capability === "unsupported";

  async function handleToggle() {
    if (enabled) {
      startTransition(async () => {
        await setReminderSettings({ enabled: false, hour });
        toast.success("Lembrete desativado");
        router.refresh();
      });
      return;
    }

    setBusy(true);
    const result = await enableReminderOnThisDevice(hour);
    setBusy(false);
    if (result === "enabled") {
      toast.success(`Lembrete diário ativado às ${hour}h`);
      router.refresh();
    } else {
      toast.error(
        result === "denied"
          ? "As notificações estão bloqueadas neste navegador."
          : "Não foi possível ativar o lembrete. Tente de novo mais tarde."
      );
      router.refresh();
    }
  }

  function handleHourChange(next: number) {
    startTransition(async () => {
      await setReminderSettings({ enabled, hour: next });
      toast.success(`Lembrete às ${next}h`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-medium">Lembrete diário</h2>
          <p className="text-sm text-muted-foreground">
            Uma notificação por dia, só se você ainda não registrou nada.
          </p>
        </div>

        {capability === "denied" && (
          <p className="text-sm text-destructive">
            As notificações estão bloqueadas neste navegador. Para reativar,
            abra as configurações do site (ícone de cadeado na barra de
            endereço), permita Notificações e volte aqui.
          </p>
        )}
        {capability === "needs-install" && (
          <p className="text-sm text-muted-foreground">
            No iPhone, o lembrete só funciona com o app instalado. Toque em
            Compartilhar e depois em Adicionar à Tela de Início.
          </p>
        )}
        {capability === "unsupported" && (
          <p className="text-sm text-muted-foreground">
            Este navegador não suporta notificações push.
          </p>
        )}

        <Button
          type="button"
          variant={enabled ? "outline" : "default"}
          className="min-h-11"
          onClick={handleToggle}
          disabled={pending || busy || (blocked && !enabled)}
        >
          {enabled ? "Desativar lembrete" : busy ? "Ativando…" : "Ativar lembrete"}
        </Button>

        {enabled && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Horário do lembrete
            <select
              className="min-h-11 rounded-lg border border-input bg-transparent px-2.5 text-base"
              value={hour}
              disabled={pending}
              onChange={(event) => handleHourChange(Number(event.target.value))}
            >
              {hours.map((option) => (
                <option key={option} value={option}>
                  {String(option).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        )}
      </CardContent>
    </Card>
  );
}

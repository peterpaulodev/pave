"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getPushCapability } from "@/lib/push/client";
import { enableReminderOnThisDevice } from "@/lib/push/enable";
import { readStorage, subscribeStorage, writeStorage } from "@/lib/safe-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const SNOOZE_KEY = "pave:reminder-invite-snoozed-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_HOUR = 20;

type InviteState = "hidden" | "enable" | "install";

function readInviteState(): InviteState {
  const until = Number(readStorage(SNOOZE_KEY) ?? 0);
  if (until > Date.now()) return "hidden";

  const capability = getPushCapability();
  if (capability === "needs-install") return "install";
  return capability === "ready" ? "enable" : "hidden"; // denied/unsupported: no invite
}

/**
 * Invite to turn on the daily reminder, shown after the first saved expense
 * (the server only renders it then). It never asks for permission by
 * itself: `Notification.requestPermission()` runs only inside the tap on
 * "Ativar" (design.md D6).
 */
export function ReminderInvite() {
  // Server snapshot "hidden": nothing renders before hydration.
  const state = useSyncExternalStore(subscribeStorage, readInviteState, () => "hidden");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  if (state === "hidden") return null;

  function snooze() {
    writeStorage(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  }

  async function handleEnable() {
    setPending(true);
    const result = await enableReminderOnThisDevice(DEFAULT_HOUR);
    setPending(false);

    if (result === "enabled") {
      toast.success("Lembrete diário ativado às 20h");
      router.refresh();
      return;
    }
    snooze(); // refused or failed: don't ask again for 7 days
    toast.error(
      result === "denied"
        ? "Sem permissão para notificar. Você pode ativar depois em Configurações."
        : "Não foi possível ativar o lembrete. Tente de novo mais tarde."
    );
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm font-medium">Quer um lembrete diário para não esquecer?</p>
        {state === "install" ? (
          <p className="text-sm text-muted-foreground">
            Toque em Compartilhar e depois em Adicionar à Tela de Início.
          </p>
        ) : null}
        <div className="flex gap-2">
          {state === "enable" && (
            <Button className="min-h-11" onClick={handleEnable} disabled={pending}>
              {pending ? "Ativando…" : "Ativar"}
            </Button>
          )}
          <Button variant="outline" className="min-h-11" onClick={snooze} disabled={pending}>
            Agora não
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

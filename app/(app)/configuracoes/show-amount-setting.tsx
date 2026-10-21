"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setReminderShowAmount } from "@/actions/push";
import { Card, CardContent } from "@/components/ui/card";

export function ShowAmountSetting({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await setReminderShowAmount(next);
      if (result.error) {
        setChecked(!next);
        toast.error("Não foi possível salvar. Tente de novo.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent>
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            role="switch"
            className="mt-1 size-5 shrink-0"
            checked={checked}
            disabled={pending}
            onChange={(event) => handleChange(event.target.checked)}
          />
          <span className="flex flex-col gap-1">
            <span className="text-base font-medium">
              Mostrar quanto sobra de lazer no lembrete
            </span>
            <span className="text-sm text-muted-foreground">
              O valor aparece na tela de bloqueio, visível para quem estiver
              perto do seu celular.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}

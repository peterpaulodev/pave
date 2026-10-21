"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markNoSpendToday } from "@/actions/checkin";
import { Button } from "@/components/ui/button";

export function NoSpendButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await markNoSpendToday();
      toast.success("Dia registrado: sem gastos hoje");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 self-start"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "Registrando…" : "Não gastei nada hoje"}
    </Button>
  );
}

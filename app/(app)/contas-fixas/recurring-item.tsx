"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BUCKET_LABELS } from "@/lib/domain/buckets";
import { formatBRL } from "@/lib/money";
import {
  deleteRecurringAction,
  setRecurringActiveAction,
} from "@/actions/recurring";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RecurringForm, type RecurringFormItem } from "./recurring-form";

export function RecurringItem({
  item,
}: {
  item: RecurringFormItem & { active: boolean };
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggleActive() {
    startTransition(async () => {
      const result = await setRecurringActiveAction(item.id, !item.active);
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível atualizar");
        return;
      }
      toast.success(item.active ? "Conta pausada" : "Conta reativada");
      router.refresh();
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteRecurringAction(item.id);
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível excluir");
        return;
      }
      toast.success("Conta fixa excluída");
      setConfirmingDelete(false);
      router.refresh();
    });
  }

  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${
        item.active ? "" : "opacity-60"
      }`}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{item.description}</span>
        <span className="text-xs text-muted-foreground">
          {BUCKET_LABELS[item.bucket]} · todo dia {item.dayOfMonth}
          {item.active ? "" : " · Pausada"}
        </span>
        <span className="text-sm font-medium">{formatBRL(item.amountCents)}</span>
      </div>

      <div className="flex shrink-0 items-center">
        <RecurringForm mode="edit" item={item} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label={item.active ? `Pausar ${item.description}` : `Reativar ${item.description}`}
          onClick={toggleActive}
          disabled={pending}
        >
          {item.active ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label={`Excluir ${item.description}`}
          onClick={() => setConfirmingDelete(true)}
          disabled={pending}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <Sheet open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <SheetContent side="bottom" className="p-4">
          <SheetHeader className="p-0">
            <SheetTitle>Excluir “{item.description}”?</SheetTitle>
            <SheetDescription>
              Os lançamentos já feitos continuam no histórico. Só os próximos
              meses deixam de receber essa conta.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="destructive"
              className="min-h-11 w-full"
              onClick={confirmDelete}
              disabled={pending}
            >
              {pending ? "Excluindo…" : "Excluir"}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancelar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </li>
  );
}

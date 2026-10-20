"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteExpense } from "@/actions/expenses";

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpense(expenseId);
      if (!result.data.deleted) {
        toast.error("Não foi possível excluir o gasto");
        return;
      }
      toast.success("Gasto excluído");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-11 w-11"
      aria-label="Excluir gasto"
      onClick={handleDelete}
      disabled={pending}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

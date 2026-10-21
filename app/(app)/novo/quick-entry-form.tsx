"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { parseQuickEntry } from "@/lib/domain/parse-quick-entry";
import { suggestBucket } from "@/lib/domain/suggest-bucket";
import type { Bucket } from "@/lib/domain/buckets";
import { BucketToggle } from "@/components/bucket-toggle";
import { formatBRL } from "@/lib/money";
import { createExpense, deleteExpense } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuickEntryForm({
  source = "quick_entry",
}: {
  source?: "quick_entry" | "notification";
}) {
  const [input, setInput] = useState("");
  // null until the user taps the toggle themselves — until then, the
  // effective bucket below is derived from the description (7.2/7.3).
  const [userPickedBucket, setUserPickedBucket] = useState<Bucket | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const parsed = useMemo(() => parseQuickEntry(input), [input]);
  const suggestedBucket: Bucket = parsed
    ? suggestBucket(parsed.description) ?? "needs"
    : "needs";
  const bucket = userPickedBucket ?? suggestedBucket;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!parsed) {
      setError(
        input.trim() === ""
          ? 'Digite um valor e uma descrição, como "mercado 120"'
          : 'Não entendi o valor. Tente algo como "mercado 120"'
      );
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createExpense({
        amountCents: parsed.amountCents,
        description: parsed.description,
        bucket,
        source,
      });

      if (!result.data) {
        setError(result.error ?? "Não foi possível salvar o gasto");
        return;
      }

      const expenseId = result.data.id;
      toast.success(
        `${parsed.description} · ${formatBRL(parsed.amountCents)} salvo`,
        {
          action: {
            label: "Desfazer",
            onClick: () => {
              void deleteExpense(expenseId);
            },
          },
        }
      );
      router.push("/");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        type="text"
        autoFocus
        placeholder="mercado 120"
        aria-label="Valor e descrição do gasto"
        className="min-h-11 text-lg"
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          setError(null);
        }}
      />

      {parsed && (
        <BucketToggle value={bucket} onChange={setUserPickedBucket} />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

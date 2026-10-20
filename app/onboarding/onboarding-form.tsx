"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { parseBRL, formatBRL } from "@/lib/money";
import { splitIncome, type Bucket } from "@/lib/domain/buckets";
import { completeOnboarding } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const BUCKET_LABELS: Record<Bucket, string> = {
  needs: "Necessidades",
  wants: "Lazer",
  savings: "Investimentos",
};

const BUCKET_EXAMPLES: Record<Bucket, string> = {
  needs: "aluguel, mercado, contas",
  wants: "ifood, cinema, streaming",
  savings: "reserva, CDB, tesouro",
};

const BUCKET_ORDER: Bucket[] = ["needs", "wants", "savings"];

export function OnboardingForm() {
  const [input, setInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, startTransition] = useTransition();

  const incomeCents = useMemo(() => parseBRL(input), [input]);
  const isValid = incomeCents !== null && incomeCents > 0;
  const split = isValid ? splitIncome(incomeCents) : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!isValid || incomeCents === null) return;

    startTransition(async () => {
      const result = await completeOnboarding(incomeCents);
      // On success, completeOnboarding() redirects — this line only runs
      // if it returned instead, i.e. validation failed server-side.
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  const showError = touched && input !== "" && !isValid;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Qual sua renda mensal?</CardTitle>
          <CardDescription>
            Vamos dividir em 3 baldes pelo método 50/30/20 — sem mais nenhuma
            configuração.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder="R$ 0,00"
              aria-label="Renda mensal"
              className="min-h-11 text-lg"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setTouched(false);
              }}
              onBlur={() => setTouched(true)}
            />
            {showError && (
              <p className="text-sm text-destructive">
                Informe quanto você recebe por mês
              </p>
            )}

            {split && (
              <div className="flex flex-col gap-3 rounded-md border p-3">
                {BUCKET_ORDER.map((bucket) => (
                  <div key={bucket} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {BUCKET_LABELS[bucket]}
                      </span>
                      <span>{formatBRL(split[bucket])}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {BUCKET_EXAMPLES[bucket]}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="submit"
              className="min-h-11 w-full"
              disabled={!isValid || pending}
            >
              {pending ? "Salvando…" : "Continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

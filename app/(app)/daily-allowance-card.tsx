"use client";

import { useState } from "react";
import type { DailyAllowance } from "@/lib/domain/daily-allowance";
import { formatBRL } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Today's leisure allowance (design.md D4). Informational tone: only the
 * exhausted bucket uses the destructive style, matching the Lazer card when
 * it's over its limit; going over today's amount is just a note.
 */
export function DailyAllowanceCard({ allowance }: { allowance: DailyAllowance }) {
  const [explaining, setExplaining] = useState(false);
  const { status, daysLeft } = allowance;

  if (status === "bucket_exhausted") {
    return (
      <Card size="sm" className="border-destructive">
        <CardContent>
          <p className="text-sm font-medium text-destructive">
            O lazer deste mês acabou. Ele volta no dia 1.
          </p>
        </CardContent>
      </Card>
    );
  }

  const value = (
    <button
      type="button"
      onClick={() => setExplaining(true)}
      aria-label="Como esse valor é calculado"
      className="inline-flex min-h-11 items-center font-semibold underline decoration-dotted underline-offset-4"
    >
      {formatBRL(allowance.allowanceCents)}
    </button>
  );

  return (
    <>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1">
          <p className="text-2xl leading-snug">
            {daysLeft === 1 ? (
              <>Último dia do mês: {value} de lazer</>
            ) : (
              <>Hoje você pode gastar {value} com lazer</>
            )}
          </p>
          {status === "over_today" ? (
            <p className="text-sm text-muted-foreground">
              Você passou {formatBRL(Math.abs(allowance.remainingTodayCents))} do
              valor de hoje. Amanhã o valor diário se ajusta.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Já gastou {formatBRL(allowance.spentTodayCents)} · resta{" "}
              {formatBRL(allowance.remainingTodayCents)}
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet open={explaining} onOpenChange={setExplaining}>
        <SheetContent side="bottom" className="p-4">
          <SheetHeader className="p-0">
            <SheetTitle>Como esse valor é calculado</SheetTitle>
            <SheetDescription>
              {daysLeft === 1
                ? "Hoje é o último dia do mês: o valor de hoje é tudo o que sobra de lazer."
                : `Pegamos o que sobra de lazer no mês e dividimos pelos ${daysLeft} dias que faltam, contando hoje.`}{" "}
              É um teto, não uma meta: gastar menos deixa mais para os próximos
              dias.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </>
  );
}

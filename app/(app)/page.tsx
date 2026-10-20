import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import {
  getCycleBalances,
  getOrCreateCycle,
  getUserSettings,
  listExpenses,
} from "@/server/queries";
import { currentPeriod } from "@/lib/domain/period";
import { formatBRL } from "@/lib/money";
import type { Bucket } from "@/lib/domain/buckets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteExpenseButton } from "./delete-expense-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel · Pave",
};

const BUCKET_ORDER: Bucket[] = ["needs", "wants", "savings"];

const BUCKET_LABELS: Record<Bucket, string> = {
  needs: "Necessidades",
  wants: "Lazer",
  savings: "Investimentos",
};

export default async function PainelPage() {
  // app/(app)/layout.tsx already guarantees onboarding is done before any
  // page in this group renders.
  const { id: userId } = await getSessionUserOrRedirect();
  const settings = await getUserSettings(userId);
  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  const period = currentPeriod(timezone);

  // 8.6: creates the cycle on demand if this is the first visit to a new
  // month, seeded from the user's default income.
  const cycle = await getOrCreateCycle(userId, period);
  const balances = await getCycleBalances(userId, cycle.id);
  const expenses = await listExpenses(userId, cycle.id);

  return (
    <div className="flex flex-col gap-6 pb-20">
      <h1 className="text-xl font-semibold">Seu mês</h1>

      <div className="flex flex-col gap-3">
        {BUCKET_ORDER.map((bucket) => {
          const balance = balances[bucket];
          const isOver = balance.availableCents < 0;

          return (
            <Card
              key={bucket}
              className={isOver ? "border-destructive" : undefined}
            >
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center justify-between text-base font-medium">
                  <span>{BUCKET_LABELS[bucket]}</span>
                  {isOver && (
                    <span className="text-xs font-normal text-destructive">
                      Estourou {formatBRL(Math.abs(balance.availableCents))}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <p
                  className={
                    isOver
                      ? "text-2xl font-semibold text-destructive"
                      : "text-2xl font-semibold"
                  }
                >
                  {formatBRL(Math.max(balance.availableCents, 0))}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    disponíveis
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBRL(balance.spentCents)} de{" "}
                  {formatBRL(balance.limitCents)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum gasto registrado neste mês ainda.
            </p>
            <Button render={<Link href="/novo" />} className="min-h-11">
              Registrar primeiro gasto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Últimos gastos
          </h2>
          <ul className="flex flex-col gap-2">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {expense.description}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {BUCKET_LABELS[expense.bucket]}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">
                    {formatBRL(expense.amountCents)}
                  </span>
                  <DeleteExpenseButton expenseId={expense.id} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/novo"
        aria-label="Novo gasto"
        className="fixed right-4 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+1rem)] z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg lg:right-6 lg:bottom-6"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Link>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import {
  getCycleBalances,
  getOrCreateCycle,
  getUserSettings,
  listExpenses,
} from "@/server/queries";
import { currentPeriod, periodLabel, previousPeriod } from "@/lib/domain/period";
import { canShowSummaryLink } from "@/lib/domain/monthly-summary";
import { getSummaryEligibility, hasCycleForPeriod } from "@/server/monthly-summary";
import { localDate } from "@/lib/domain/local-date";
import { computeStreak } from "@/lib/domain/streak";
import { getRegisteredDates, hasManualExpense } from "@/server/checkin";
import { getDailyAllowanceInputs } from "@/server/daily-allowance";
import { computeDailyAllowance } from "@/lib/domain/daily-allowance";
import { countRecurring, getRecurringTotalsByBucket } from "@/server/recurring";
import { formatBRL } from "@/lib/money";
import { BUCKET_LABELS, BUCKET_ORDER } from "@/lib/domain/buckets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyAllowanceCard } from "./daily-allowance-card";
import { DeleteExpenseButton } from "./delete-expense-button";
import { RecurringNotice } from "./recurring-notice";
import { NoSpendButton } from "./no-spend-button";
import { ReminderInvite } from "./reminder-invite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel · Pave",
};

/** "10/04" from a pure `@db.Date` value (UTC midnight, no time zone shift). */
function formatShortDate(date: Date): string {
  const [, month, day] = date.toISOString().slice(0, 10).split("-");
  return `${day}/${month}`;
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ summary?: string | string[] }>;
}) {
  // app/(app)/layout.tsx already guarantees onboarding is done before any
  // page in this group renders.
  const { id: userId } = await getSessionUserOrRedirect();
  const settings = await getUserSettings(userId);
  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  const period = currentPeriod(timezone);
  const today = localDate(timezone);

  // Server-side, before anything renders: the first visit of a new month
  // shows last month's summary (only here — /novo never redirects).
  // `?summary=seen` is the "Começar" button's failsafe: it skips the redirect
  // for this request only, so a failed write can't trap the user in the summary.
  const { summary: summaryParam } = await searchParams;
  const lastPeriod = previousPeriod(period);
  if (summaryParam !== "seen" && (await getSummaryEligibility(userId, lastPeriod))) {
    redirect(`/resumo/${lastPeriod}?auto=1`);
  }
  const showSummaryLink =
    canShowSummaryLink(today) && (await hasCycleForPeriod(userId, lastPeriod));

  // 8.6: creates the cycle on demand if this is the first visit to a new
  // month, seeded from the user's default income.
  const cycle = await getOrCreateCycle(userId, period);
  const balances = await getCycleBalances(userId, cycle.id);
  const expenses = await listExpenses(userId, cycle.id);
  const [recurringTotals, recurringCount] = await Promise.all([
    getRecurringTotalsByBucket(userId, cycle.id),
    countRecurring(userId),
  ]);
  const [registeredDates, hasSavedExpense, allowanceInputs] = await Promise.all([
    getRegisteredDates(userId, timezone),
    hasManualExpense(userId),
    getDailyAllowanceInputs(userId, cycle.id, today),
  ]);
  const allowance = allowanceInputs
    ? computeDailyAllowance({ ...allowanceInputs, today })
    : null;
  const registeredToday = registeredDates.includes(today);
  const streak = computeStreak(registeredDates, today);
  const hasAutomaticExpenses = expenses.some((e) => e.recurringExpenseId);

  return (
    <div className="flex flex-col gap-6 pb-20">
      <h1 className="text-xl font-semibold">Seu mês</h1>

      {showSummaryLink && (
        <Link
          href={`/resumo/${lastPeriod}`}
          prefetch={false}
          className="-mt-3 min-h-11 self-start py-2 text-sm font-medium underline underline-offset-4"
        >
          Ver resumo de {periodLabel(lastPeriod)}
        </Link>
      )}

      {allowance && <DailyAllowanceCard allowance={allowance} />}

      <Card size="sm">
        <CardContent className="flex flex-col gap-2">
          {streak > 0 ? (
            <p className="text-sm font-medium">
              {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
              {!registeredToday && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · registre hoje para continuar
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Comece uma sequência: registre um gasto ou marque que não gastou
              nada hoje.
            </p>
          )}
          {!registeredToday && <NoSpendButton />}
        </CardContent>
      </Card>

      {hasSavedExpense && !settings?.reminderEnabled && <ReminderInvite />}

      {hasAutomaticExpenses && <RecurringNotice period={period} />}

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
                {recurringTotals[bucket] > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(recurringTotals[bucket])} em contas fixas
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {recurringCount === 0 && (
        <Card size="sm">
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm">
              Tem contas que se repetem todo mês? Cadastre uma vez e elas
              entram sozinhas.
            </p>
            <Button
              variant="outline"
              render={<Link href="/contas-fixas" />}
              className="min-h-11 self-start"
            >
              Cadastrar contas fixas
            </Button>
          </CardContent>
        </Card>
      )}

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
                  <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {BUCKET_LABELS[expense.bucket]}
                    {expense.recurringExpenseId && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium text-foreground">
                        Fixa
                      </span>
                    )}
                    {expense.occurredOn.toISOString().slice(0, 10) > today && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium text-foreground">
                        Agendado · {formatShortDate(expense.occurredOn)}
                      </span>
                    )}
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

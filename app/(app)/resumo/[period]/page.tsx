import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { BUCKET_LABELS, BUCKET_ORDER, type Bucket } from "@/lib/domain/buckets";
import { periodLabel } from "@/lib/domain/period";
import { formatBRL } from "@/lib/money";
import { getSummaryView } from "@/server/monthly-summary";
import { trackEvent } from "@/server/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StartMonthButton } from "./start-month-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resumo do mês · Pave",
};

/** The gap to the limit, stated as a fact — no alert colours, no blame. */
function diffText(diffCents: number): string {
  if (diffCents > 0) return `${formatBRL(diffCents)} abaixo do planejado`;
  if (diffCents < 0) return `${formatBRL(-diffCents)} acima do planejado`;
  return "Exatamente no planejado";
}

export default async function ResumoPage({
  params,
  searchParams,
}: {
  params: Promise<{ period: string }>;
  searchParams: Promise<{ auto?: string | string[] }>;
}) {
  const { id: userId } = await getSessionUserOrRedirect();
  const { period: rawPeriod } = await params;
  const view = await getSummaryView(userId, rawPeriod);
  if (!view) notFound();

  const { period, summary, isPrevious, currentMonthLabel } = view;
  const { auto } = await searchParams;
  // Only the month right before the current one can have been shown automatically.
  trackEvent(userId, "monthly_summary_viewed", { auto: auto === "1" && isPrevious });

  const { highlight, savings, fixed, wantsDestinations, startedOnDay } = summary;
  const startsHere = auto === "1" && isPrevious;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Resumo de {periodLabel(period)}</h1>
        {startedOnDay !== null && (
          <p className="text-sm text-muted-foreground">
            Desde que você começou, no dia {startedOnDay}.
          </p>
        )}
      </div>

      <Card className="bg-primary/10">
        <CardContent>
          <p className="text-lg font-semibold">{highlight.text}</p>
        </CardContent>
      </Card>

      {BUCKET_ORDER.map((bucket: Bucket) => {
        const balance = summary.buckets[bucket];
        return (
          <Card key={bucket} size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-base font-medium">{BUCKET_LABELS[bucket]}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {bucket === "savings" ? (
                <p className="text-lg font-semibold">
                  Você guardou {formatBRL(savings.savedCents)} de{" "}
                  {formatBRL(savings.goalCents)}
                </p>
              ) : (
                <>
                  <p className="text-lg font-semibold">
                    {formatBRL(balance.spentCents)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      de {formatBRL(balance.limitCents)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{diffText(balance.diffCents)}</p>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {fixed.totalCents > 0 && (
        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-medium">Contas fixas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="text-lg font-semibold">{formatBRL(fixed.totalCents)} no mês</p>
            {fixed.needsCents > 0 && (
              <p className="text-sm text-muted-foreground">
                {formatBRL(fixed.needsCents)} ocuparam {BUCKET_LABELS.needs}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {wantsDestinations.length > 0 && (
        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-medium">Para onde foi o lazer</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-1">
              {wantsDestinations.map((destination) => (
                <li key={destination.name} className="flex items-center justify-between gap-2 text-sm">
                  <span>{destination.name}</span>
                  <span className="font-medium">{formatBRL(destination.totalCents)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card size="sm">
        <CardContent>
          <p className="text-sm">
            Você registrou em {summary.registeredDays} de {summary.trackedDays} dias
            {startedOnDay !== null && ` (a partir do dia ${startedOnDay})`}
          </p>
        </CardContent>
      </Card>

      {startsHere ? (
        <StartMonthButton period={period} monthLabel={currentMonthLabel} />
      ) : (
        <Button variant="outline" render={<Link href="/" />} nativeButton={false} className="min-h-11 w-full">
          Voltar
        </Button>
      )}
    </div>
  );
}

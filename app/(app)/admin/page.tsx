import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { requireAdmin } from "@/server/admin";
import { getMetrics } from "@/server/metrics";
import { env } from "@/lib/env";
import { formatRatio, parseAdminIds } from "@/lib/domain/metrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Métricas · Pave",
  robots: { index: false },
};

const WINDOWS = [7, 30, 90] as const;

// Invalid or missing values fall back to the defaults instead of erroring.
const searchSchema = z.object({
  window: z.enum(["7", "30", "90"]).catch("30"),
  me: z.enum(["1"]).optional().catch(undefined),
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function href(windowDays: number, includeMe: boolean): string {
  const params = new URLSearchParams({ window: String(windowDays) });
  if (includeMe) params.set("me", "1");
  return `/admin?${params}`;
}

const pill =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium ring-1 ring-foreground/10";

function MetricCard({
  title,
  value,
  hint,
  children,
}: {
  title: string;
  value: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();

  const parsed = searchSchema.parse(await searchParams);
  const windowDays = Number(parsed.window);
  const includeMe = parsed.me === "1";

  const metrics = await getMetrics({
    windowDays,
    excludeUserIds: includeMe ? [] : parseAdminIds(env.ADMIN_USER_IDS),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Métricas</h1>

      <nav aria-label="Janela" className="flex gap-2">
        {WINDOWS.map((days) => (
          <Link
            key={days}
            href={href(days, includeMe)}
            aria-current={days === windowDays ? "page" : undefined}
            className={cn(
              pill,
              "flex-1",
              days === windowDays && "bg-primary text-primary-foreground"
            )}
          >
            {days} dias
          </Link>
        ))}
      </nav>
      <Link
        href={href(windowDays, !includeMe)}
        aria-pressed={includeMe}
        className={cn(pill, includeMe && "bg-primary text-primary-foreground")}
      >
        {includeMe ? "Incluindo meus dados" : "Incluir meus dados"}
      </Link>

      <MetricCard
        title="Conclusão do onboarding"
        value={formatRatio(metrics.onboarding.num, metrics.onboarding.den)}
        hint={`Usuários criados nos últimos ${windowDays} dias que concluíram`}
      />
      <MetricCard
        title="Retenção na semana 2"
        value={formatRatio(
          metrics.weekTwoRetention.num,
          metrics.weekTwoRetention.den
        )}
        hint="Onboarding entre 14 e 44 dias atrás; registraram algo entre os dias 7 e 13 (não depende da janela)"
      />
      <MetricCard
        title="Lançamentos via notificação"
        value={formatRatio(
          metrics.notificationExpenses.num,
          metrics.notificationExpenses.den
        )}
        hint={`Gastos manuais vindos da notificação · ${metrics.remindersSent} ${metrics.remindersSent === 1 ? "lembrete enviado" : "lembretes enviados"}`}
      >
        <p className="text-sm tabular-nums">
          Por lembrete enviado:{" "}
          {formatRatio(
            metrics.notificationPerReminder.num,
            metrics.notificationPerReminder.den
          )}
        </p>
      </MetricCard>
      <MetricCard
        title="Acerto da sugestão de balde"
        value={formatRatio(metrics.bucketHit.num, metrics.bucketHit.den)}
        hint="Gastos manuais com sugestão em que o balde não foi trocado"
      >
        <p className="text-sm tabular-nums">
          Sem sugestão do dicionário:{" "}
          {formatRatio(metrics.noSuggestion.num, metrics.noSuggestion.den)}
        </p>
      </MetricCard>

      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          title="Ativos em 7 dias"
          value={String(metrics.activeUsers7d)}
          hint="Registraram um gasto ou dia sem gasto"
        />
        <MetricCard
          title="Com lembrete"
          value={String(metrics.usersWithReminder)}
          hint="Lembrete diário ativo"
        />
      </div>
    </div>
  );
}

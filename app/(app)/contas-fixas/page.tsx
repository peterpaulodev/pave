import type { Metadata } from "next";
import { getSessionUserOrRedirect } from "@/lib/auth/session";
import { getUserSettings } from "@/server/queries";
import { listRecurring } from "@/server/recurring";
import { currentPeriod } from "@/lib/domain/period";
import { localDate } from "@/lib/domain/local-date";
import { isDuePassed, resolveDueDate } from "@/lib/domain/recurring";
import { Card, CardContent } from "@/components/ui/card";
import { RecurringForm } from "./recurring-form";
import { RecurringItem } from "./recurring-item";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contas fixas · Pave",
};

export default async function ContasFixasPage() {
  const { id: userId } = await getSessionUserOrRedirect();
  const settings = await getUserSettings(userId);
  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  const period = currentPeriod(timezone);
  const today = localDate(timezone);

  // Default of "Lançar também neste mês", per due day 1..31, computed here
  // with the user's local date so the client never deals with time zones.
  const duePassedByDay: Record<number, boolean> = {};
  for (let day = 1; day <= 31; day += 1) {
    duePassedByDay[day] = isDuePassed(resolveDueDate(period, day), today);
  }

  const items = await listRecurring(userId);

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Contas fixas</h1>
        <RecurringForm mode="create" duePassedByDay={duePassedByDay} />
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-1 py-8 text-center">
            <p className="text-sm font-medium">Nenhuma conta fixa ainda</p>
            <p className="text-sm text-muted-foreground">
              Cadastre aluguel, luz, internet… uma vez só, e elas entram
              sozinhas em todo mês.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <RecurringItem
              key={item.id}
              item={{
                id: item.id,
                description: item.description,
                amountCents: item.amountCents,
                bucket: item.bucket,
                dayOfMonth: item.dayOfMonth,
                active: item.active,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

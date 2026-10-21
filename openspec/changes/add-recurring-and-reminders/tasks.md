## 1. Banco de dados
- [x] 1.1 Adicionar ao `prisma/schema.prisma`: models `RecurringExpense`, `PushSubscription`, `DailyCheckin`; campos novos em `Expense` (`recurringExpenseId` + unique `(recurringExpenseId, cycleId)`), `BudgetCycle` (`recurringAppliedAt`) e `UserSettings` (`reminderEnabled`, `reminderHour`, `lastReminderSentOn`), conforme design.md
- [x] 1.2 Gerar migration com `prisma migrate dev --create-only --name recurring_and_reminders` (`migrate dev` recusa rodar sem TTY; o SQL veio de `prisma migrate diff --from-config-datasource --to-schema` e a pasta foi criada à mão, equivalente ao `--create-only`)
- [x] 1.3 Adicionar no SQL: CHECKs (`amount_cents > 0`, `day_of_month BETWEEN 1 AND 31`, `reminder_hour BETWEEN 0 AND 23`) e `UPDATE budget_cycles SET recurring_applied_at = now() WHERE recurring_applied_at IS NULL`
- [x] 1.4 Mostrar o SQL para revisão e só aplicar na branch `dev` após confirmação

## 2. Domínio (TS puro, com testes)
- [x] 2.1 `lib/domain/local-date.ts`: `localDate(tz, now?)` → `YYYY-MM-DD` e `localHour(tz, now?)` → 0–23
- [x] 2.2 Testes de `local-date`: virada de dia em `America/Sao_Paulo` vs UTC (ex.: 23:30 UTC-3 = 02:30 UTC do dia seguinte)
- [x] 2.3 `lib/domain/recurring.ts`: `resolveDueDate(period, dayOfMonth)` e `isDuePassed(dueDate, today)`
- [x] 2.4 Testes de `recurring`: dia 31 em abril → 30; dia 30/31 em fevereiro comum e bissexto; dia 1; vencimento hoje conta como não passado
- [x] 2.5 `lib/domain/streak.ts`: `computeStreak(dates, today)`
- [x] 2.6 Testes de `streak`: sequência com hoje, sem hoje (termina ontem), quebrada ontem → 0, datas duplicadas, lista vazia

## 3. Camada de dados
- [x] 3.1 `server/recurring.ts`: `listRecurring`, `createRecurring`, `updateRecurring`, `setRecurringActive`, `deleteRecurring` — todas escopadas por `userId`
- [x] 3.2 `applyRecurringToCycle(userId, cycleId)`: só roda se `recurringAppliedAt` for `null`; `createMany({ skipDuplicates: true })` + grava `recurringAppliedAt` na mesma `$transaction` (desvio: o carimbo é reivindicado primeiro com `updateMany where recurringAppliedAt null` e o `createMany` roda depois, ambos na mesma `$transaction`; um concorrente espera a linha e vê o carimbo já gravado, o que dá a mesma garantia de uma vez só)
- [x] 3.3 Integrar `applyRecurringToCycle` ao `getOrCreateCycle` (apenas quando o ciclo é criado) (o ciclo e as contas fixas são criados na mesma `$transaction`; `upsert` virou `findUnique` + `create`, para só lançar quando o ciclo é de fato criado. `completeOnboarding` continua criando o ciclo sozinho, sem aplicar contas fixas, pois um usuário em onboarding ainda não tem nenhuma)
- [x] 3.4 `createRecurring` com `alsoThisMonth`: cria template e `Expense` do ciclo atual na mesma transação (a assinatura recebe `alsoThisMonth: { cycleId }`, com o ciclo vindo do chamador via `getOrCreateCycle`; isso evita import circular entre `queries.ts` e `recurring.ts`)
- [x] 3.5 `server/checkin.ts`: `markNoSpend(userId, date)` idempotente (upsert na unique `userId_date`)
- [x] 3.6 `getRegisteredDates(userId, tz, days = 60)`: datas locais distintas de `Expense.createdAt` **sem** `recurringExpenseId` ∪ `DailyCheckin.date`
- [x] 3.7 Testes de integração: aplicação única por ciclo, concorrência (dois `getOrCreateCycle` simultâneos), exclusão não recria, pausada não lança, isolamento entre usuários

## 4. Contas fixas — UI (spec: recurring-expenses)
- [ ] 4.1 Página `/(app)/contas-fixas`: lista com descrição, valor, balde, dia, ativo/pausado
- [ ] 4.2 Formulário (sheet) de criar/editar: descrição, valor (`parseBRL`), balde com sugestão via `suggestBucket`, dia 1–31
- [ ] 4.3 Checkbox "Lançar também neste mês" com default por `isDuePassed`
- [ ] 4.4 Ações: pausar/reativar, excluir com confirmação ("os lançamentos já feitos continuam no histórico")
- [ ] 4.5 Server Actions em `actions/recurring.ts` com validação zod; `userId` sempre da sessão
- [ ] 4.6 Link para contas fixas na navegação do app

## 5. Painel (spec: budget-dashboard)
- [ ] 5.1 Selos "Fixa" e "Agendado" (com data) na lista de gastos
- [ ] 5.2 Linha "R$ X em contas fixas" em cada card de balde quando houver
- [ ] 5.3 Convite para cadastrar contas fixas quando o usuário não tiver nenhuma
- [ ] 5.4 Texto explicativo na primeira vez que gastos automáticos aparecerem no mês

## 6. Web Push — infraestrutura
- [ ] 6.1 Instalar `web-push` (+ `@types/web-push`); adicionar envs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` ao `lib/env.ts` e `.env.example`
- [ ] 6.2 `lib/push/web-push.ts`: `sendToUser(userId, payload)` com `Promise.allSettled`, removendo subscription em 404/410
- [ ] 6.3 `app/sw.ts`: handlers `push` (exibe notificação com `data.url` e ação "Não gastei nada") e `notificationclick` (foca janela existente ou abre `/novo`; ação dispara `POST /api/checkin/no-spend`)
- [ ] 6.4 Rota `app/api/checkin/no-spend/route.ts` autenticada pela sessão (usada pela ação da notificação)
- [ ] 6.5 `lib/push/client.ts`: `subscribeToPush()` com `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
- [ ] 6.6 `actions/push.ts`: `savePushSubscription` (upsert por `endpoint`) e `removePushSubscription`

## 7. Lembrete — UI e envio (spec: daily-reminder)
- [ ] 7.1 Card de convite após o primeiro gasto: "Ativar" / "Agora não" (adiamento de 7 dias em `localStorage` com try/catch)
- [ ] 7.2 `Notification.requestPermission()` apenas no clique; no iOS fora do standalone, mostrar instrução de instalação
- [ ] 7.3 Página `/(app)/configuracoes`: ativar/desativar lembrete, horário (18h–23h), estado "permissão negada" com instrução
- [ ] 7.4 `server/reminders.ts`: `findUsersToRemind(nowUtc)` — lembrete ativo, hora local = `reminderHour`, `lastReminderSentOn` ≠ hoje local, sem registro no dia
- [ ] 7.5 `app/api/cron/reminders/route.ts`: valida `Bearer CRON_SECRET` (401 se inválido), envia, grava `lastReminderSentOn`
- [ ] 7.6 Agendador conforme decisão da Open Question: `vercel.json` (`"0 * * * *"`) ou `.github/workflows/reminders-cron.yml`
- [ ] 7.7 Botão "Não gastei nada hoje" no painel (some quando o dia já está registrado)
- [ ] 7.8 Contador de dias seguidos no painel usando `computeStreak`
- [ ] 7.9 Testes de integração do cron: envia só para quem deve, não duplica no mesmo dia, ignora gasto automático, 401 sem segredo

## 8. Validação final
- [ ] 8.1 `pnpm test`, `pnpm test:integration` (branch `dev`), `tsc --noEmit`, `pnpm lint`, `pnpm build`
- [ ] 8.2 Testar push real: Android (Chrome) e iPhone com PWA instalado
- [ ] 8.3 Testar virada de mês: simular ciclo novo com contas fixas ativas, pausadas e com dia 31
- [ ] 8.4 Listar envs novas para configurar na Vercel (Production e Preview) e no GitHub, se aplicável
- [ ] 8.5 `openspec validate add-recurring-and-reminders --strict`

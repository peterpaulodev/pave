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
- [x] 4.1 Página `/(app)/contas-fixas`: lista com descrição, valor, balde, dia, ativo/pausado (a página também mostra um estado vazio com texto explicativo)
- [x] 4.2 Formulário (sheet) de criar/editar: descrição, valor (`parseBRL`), balde com sugestão via `suggestBucket`, dia 1–31 (o sheet é aberto de baixo (mobile-first); o toggle de balde foi extraído para `components/bucket-toggle.tsx` e `BUCKET_LABELS`/`BUCKET_ORDER` para `lib/domain/buckets.ts`, reaproveitados pelo lançamento rápido e pelo painel)
- [x] 4.3 Checkbox "Lançar também neste mês" com default por `isDuePassed` (o default é calculado no servidor ao renderizar a página (mapa `duePassedByDay` dia 1–31, via `isDuePassed` com a data local do usuário); o cliente só escolhe a entrada pelo dia digitado)
- [x] 4.4 Ações: pausar/reativar, excluir com confirmação ("os lançamentos já feitos continuam no histórico") (a confirmação de exclusão é um sheet inferior, já que o projeto não tem AlertDialog)
- [x] 4.5 Server Actions em `actions/recurring.ts` com validação zod; `userId` sempre da sessão (`createRecurringAction` calcula o `cycleId` no servidor com `getOrCreateCycle` e só cria o ciclo quando "Lançar também neste mês" está marcado; nenhum `userId`/`cycleId` vem do cliente)
- [x] 4.6 Link para contas fixas na navegação do app (o item se chama "Fixas" na barra inferior)

## 5. Painel (spec: budget-dashboard)
- [x] 5.1 Selos "Fixa" e "Agendado" (com data) na lista de gastos
- [x] 5.2 Linha "R$ X em contas fixas" em cada card de balde quando houver (soma os gastos do ciclo com `recurringExpenseId`, inclusive os agendados)
- [x] 5.3 Convite para cadastrar contas fixas quando o usuário não tiver nenhuma
- [x] 5.4 Texto explicativo na primeira vez que gastos automáticos aparecerem no mês (o aviso fica visível até o usuário tocar em "Entendi" e então some pelo resto do mês (chave `pave:recurring-notice:<período>` no localStorage, com try/catch))

## 6. Web Push — infraestrutura
- [x] 6.1 Instalar `web-push` (+ `@types/web-push`); adicionar envs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` ao `lib/env.ts` e `.env.example` (`lib/env.ts` recebe as envs como opcionais, para o app subir sem elas; `sendToUser` e a rota de cron falham com erro claro quando faltam. Também entraram `SHADOW_DATABASE_URL` e `DEV_AUTH_BYPASS_USER_ID` no `.env.example`)
- [x] 6.2 `lib/push/web-push.ts`: `sendToUser(userId, payload)` com `Promise.allSettled`, removendo subscription em 404/410
- [x] 6.3 `app/sw.ts`: handlers `push` (exibe notificação com `data.url` e ação "Não gastei nada") e `notificationclick` (foca janela existente ou abre `/novo`; ação dispara `POST /api/checkin/no-spend`) (o `serwist.addEventListeners()` só registra install/activate/fetch/message, então `push` e `notificationclick` convivem no mesmo `sw.ts` sem afetar o precache. A ação "Não gastei nada" faz `fetch(..., { credentials: "include", redirect: "manual" })`; o fetch é same-origin, então os cookies de sessão do Neon Auth seguem junto. Qualquer resposta que não seja 2xx (inclusive o redirect para /login de sessão expirada) cai no fallback de abrir/focar `/novo`. Não dá para provar o envio de cookies num SW em headless; isso fica para o teste em aparelho real (8.2))
- [x] 6.4 Rota `app/api/checkin/no-spend/route.ts` autenticada pela sessão (usada pela ação da notificação) (usa o novo `getSessionUser()` (sem redirect) e responde 401 JSON sem sessão, já que um redirect para /login pareceria um 200 para o SW; também é a única forma de o endpoint funcionar sem seguir redirecionamentos)
- [x] 6.5 `lib/push/client.ts`: `subscribeToPush()` com `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
- [x] 6.6 `actions/push.ts`: `savePushSubscription` (upsert por `endpoint`) e `removePushSubscription`

## 7. Lembrete — UI e envio (spec: daily-reminder)
- [x] 7.1 Card de convite após o primeiro gasto: "Ativar" / "Agora não" (adiamento de 7 dias em `localStorage` com try/catch)
- [x] 7.2 `Notification.requestPermission()` apenas no clique; no iOS fora do standalone, mostrar instrução de instalação
- [x] 7.3 Página `/(app)/configuracoes`: ativar/desativar lembrete, horário (18h–23h), estado "permissão negada" com instrução (o link de acesso está na página Perfil, para manter a barra inferior com 4 itens)
- [x] 7.4 `server/reminders.ts`: `findUsersToRemind(nowUtc)` — lembrete ativo, hora local = `reminderHour`, `lastReminderSentOn` ≠ hoje local, sem registro no dia (a hora local e a data local vêm de `localHour`/`localDate`; `getRegisteredDates` ganhou um parâmetro `now` para a checagem de "já registrou hoje" usar o mesmo instante)
- [x] 7.5 `app/api/cron/reminders/route.ts`: valida `Bearer CRON_SECRET` (401 se inválido), envia, grava `lastReminderSentOn` (aceita só POST e responde JSON `{ checked, sent, removedSubscriptions }`; `/api/cron` ficou fora do matcher do `proxy.ts`, senão o middleware do Neon Auth responderia 307 para /login e o `curl -f` não detectaria a falha. A lógica está em `runReminderCron` (`server/reminders.ts`))
- [x] 7.6 Agendador: workflow `.github/workflows/reminders-cron.yml` (GitHub Actions) — `schedule: '7 * * * *'` + `workflow_dispatch`, um step de `curl -fsS --max-time 60 -X POST` em `${{ secrets.APP_URL }}/api/cron/reminders` com `Authorization: Bearer ${{ secrets.CRON_SECRET }}`, `timeout-minutes: 5`
- [x] 7.7 Botão "Não gastei nada hoje" no painel (some quando o dia já está registrado)
- [x] 7.8 Contador de dias seguidos no painel usando `computeStreak` (o card do painel mostra o contador; sem sequência, convida a começar uma)
- [x] 7.9 Testes de integração do cron: envia só para quem deve, não duplica no mesmo dia, ignora gasto automático, 401 sem segredo (o teste de 401 e do formato do JSON é unitário (`app/api/cron/reminders/route.test.ts`, com `runReminderCron` mockado, para não varrer usuários reais da dev); os demais casos exercitam `runReminderCron` no banco real (`server/reminders.test.ts`) com `web-push` mockado)

## 8. Validação final
- [ ] 8.1 `pnpm test`, `pnpm test:integration` (branch `dev`), `tsc --noEmit`, `pnpm lint`, `pnpm build`
- [ ] 8.2 Testar push real: Android (Chrome) e iPhone com PWA instalado
- [ ] 8.3 Testar virada de mês: simular ciclo novo com contas fixas ativas, pausadas e com dia 31
- [ ] 8.4 Listar envs novas para configurar na Vercel (Production e Preview) e no GitHub, se aplicável
- [ ] 8.5 `openspec validate add-recurring-and-reminders --strict`

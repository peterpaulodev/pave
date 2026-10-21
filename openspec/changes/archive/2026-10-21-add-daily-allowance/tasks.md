## 1. Banco de dados
- [x] 1.1 Adicionar `reminderShowAmount Boolean @default(false) @map("reminder_show_amount")` em `UserSettings`
- [x] 1.2 Gerar migration `reminder_show_amount` com `--create-only`, mostrar o SQL e aplicar na `dev` após confirmação; conferir `prisma migrate diff` vazio _(migration `20261021184927_reminder_show_amount`, aplicada na `dev` com `migrate deploy`; `migrate diff` sem diferenças)_

## 2. Domínio (TS puro, com testes)
- [x] 2.1 `lib/domain/daily-allowance.ts`: `daysLeftInMonth(today)` e `computeDailyAllowance(input)` conforme D1/D2 _(o último dia do mês vem de `resolveDueDate(período, 31)`, sem duplicar a lógica; `today` fora do formato ou inexistente (ex.: 2027-02-29) lança erro)_
- [x] 2.2 Testes de `daysLeftInMonth`: dia 1, meio do mês, último dia (30, 31, fevereiro comum e bissexto)
- [x] 2.3 Testes de `computeDailyAllowance`: exemplo da spec (R$ 450,00 ÷ 11 = 4090), arredondamento para baixo, gasto de hoje não altera `allowanceCents`, `over_today`, `bucket_exhausted` com saldo zero e negativo, último dia
- [x] 2.4 `lib/domain/reminder-text.ts`: `buildReminderBody(allowance | null, showAmount)` _(desvio: com a opção ativa e status `ok`, mas `remainingTodayCents <= 0` (gastou exatamente o valor do dia, ou o valor do dia é R$ 0,00), usa o texto padrão em vez de "Você ainda tem R$ 0,00"; a D5 não cobre esse caso)_
- [x] 2.5 Testes de `buildReminderBody`: opção desativada, `ok`, `over_today`, `bucket_exhausted`, sem ciclo (`null`); valor formatado com `formatBRL` _(o `formatBRL` usa espaço não separável; o teste compara com `formatBRL(...)` e também com o texto literal da spec normalizando espaços)_

## 3. Dados
- [x] 3.1 `server/daily-allowance.ts`: `getDailyAllowanceInputs(userId, cycleId, today)` em uma query com `SUM ... FILTER`, escopada por `userId` _(retorna também `wantsLimitCents` (join com `budget_cycles`) e `null` quando o ciclo não existe ou não é do usuário; "gasto manual" = `recurring_expense_id IS NULL`, e conta fixa que vence hoje fica em `committedCents`)_
- [x] 3.2 Testes de integração: manual de hoje vai para `spentTodayCents`; manual de ontem e retroativo vão para `committedCents`; conta fixa de Lazer agendada vai para `committedCents`; gastos de outros baldes e de outro usuário ignorados _(cobre também: manual com data futura, conta fixa que vence hoje, outro ciclo do mesmo usuário, ciclo de outro usuário (`null`), soft delete da conta fixa sem alterar valores; mutação `occurred_on = today` → `<= today` em `spentToday` derruba 2 testes (revertida))_

## 4. Painel (spec: budget-dashboard)
- [x] 4.1 Card do valor diário acima dos baldes, com valor, "Já gastou · resta" _(`DailyAllowanceCard` acima do streak e dos baldes; `today` = `localDate(timezone)` no servidor; sem ciclo/inputs, o card não aparece)_
- [x] 4.2 Estados `over_today` e `bucket_exhausted` com os textos do design (D4) _(só o `bucket_exhausted` usa o estilo destrutivo; `over_today` é texto neutro)_
- [x] 4.3 Texto especial no último dia do mês _(o texto especial vale para o estado `ok`; `over_today` no último dia mantém a mensagem de excesso)_
- [x] 4.4 Explicação ao toque (popover ou sheet) com o número de dias restantes _(reaproveita o `Sheet` (bottom) já usado em contas fixas — não havia popover no projeto; com 1 dia restante o texto muda para "Hoje é o último dia do mês…" e a explicação acrescenta que é um teto, não uma meta (Riscos do design))_
- [x] 4.5 Validar em 390px com o bypass de dev: estado normal, excedido hoje, esgotado _(estados ok, excedido e esgotado validados no painel real com dados de teste (sem overflow horizontal); o último dia do mês não é alcançável sem mexer no relógio, então foi validado numa rota temporária (já removida) renderizando o card com `today = 2026-10-31`; salvar em `/novo` atualiza o "resta hoje" sem reload manual (painel `force-dynamic`, `staleTimes.dynamic` = 0, sem precisar de `revalidatePath`))_

## 5. Lembrete (spec: daily-reminder)
- [x] 5.1 Toggle "Mostrar quanto sobra de lazer no lembrete" em `/configuracoes` (Server Action; `userId` da sessão) _(`setReminderShowAmount` em `actions/push.ts`, só `userId` da sessão; sem evento de analytics; texto de privacidade sobre a tela de bloqueio)_
- [x] 5.2 Cron: para usuários com `reminderShowAmount`, buscar ciclo existente do período (sem criar), calcular o valor diário e montar o texto com `buildReminderBody` _(`payloadFor` em `server/reminders.ts`: `findUnique` do ciclo do período local, nunca `getOrCreateCycle`; qualquer erro cai no texto padrão para não perder o lembrete)_
- [x] 5.3 Testes de integração do cron: texto padrão com opção desativada, texto com valor quando `ok`, texto padrão sem ciclo e quando excedido, e cron não cria ciclo _(asserção explícita de que a contagem de `budget_cycles` não muda após o cron; cobre também ciclo só de outro mês e gasto de outro balde)_

## 6. Validação final
- [x] 6.1 `pnpm test`, `pnpm test:integration` (branch `dev`), `tsc --noEmit`, `pnpm lint`, `pnpm build`
- [x] 6.2 `openspec validate add-daily-allowance --strict`

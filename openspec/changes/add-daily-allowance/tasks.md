## 1. Banco de dados
- [ ] 1.1 Adicionar `reminderShowAmount Boolean @default(false) @map("reminder_show_amount")` em `UserSettings`
- [ ] 1.2 Gerar migration `reminder_show_amount` com `--create-only`, mostrar o SQL e aplicar na `dev` após confirmação; conferir `prisma migrate diff` vazio

## 2. Domínio (TS puro, com testes)
- [ ] 2.1 `lib/domain/daily-allowance.ts`: `daysLeftInMonth(today)` e `computeDailyAllowance(input)` conforme D1/D2
- [ ] 2.2 Testes de `daysLeftInMonth`: dia 1, meio do mês, último dia (30, 31, fevereiro comum e bissexto)
- [ ] 2.3 Testes de `computeDailyAllowance`: exemplo da spec (R$ 450,00 ÷ 11 = 4090), arredondamento para baixo, gasto de hoje não altera `allowanceCents`, `over_today`, `bucket_exhausted` com saldo zero e negativo, último dia
- [ ] 2.4 `lib/domain/reminder-text.ts`: `buildReminderBody(allowance | null, showAmount)`
- [ ] 2.5 Testes de `buildReminderBody`: opção desativada, `ok`, `over_today`, `bucket_exhausted`, sem ciclo (`null`); valor formatado com `formatBRL`

## 3. Dados
- [ ] 3.1 `server/daily-allowance.ts`: `getDailyAllowanceInputs(userId, cycleId, today)` em uma query com `SUM ... FILTER`, escopada por `userId`
- [ ] 3.2 Testes de integração: manual de hoje vai para `spentTodayCents`; manual de ontem e retroativo vão para `committedCents`; conta fixa de Lazer agendada vai para `committedCents`; gastos de outros baldes e de outro usuário ignorados

## 4. Painel (spec: budget-dashboard)
- [ ] 4.1 Card do valor diário acima dos baldes, com valor, "Já gastou · resta"
- [ ] 4.2 Estados `over_today` e `bucket_exhausted` com os textos do design (D4)
- [ ] 4.3 Texto especial no último dia do mês
- [ ] 4.4 Explicação ao toque (popover ou sheet) com o número de dias restantes
- [ ] 4.5 Validar em 390px com o bypass de dev: estado normal, excedido hoje, esgotado

## 5. Lembrete (spec: daily-reminder)
- [ ] 5.1 Toggle "Mostrar quanto sobra de lazer no lembrete" em `/configuracoes` (Server Action; `userId` da sessão)
- [ ] 5.2 Cron: para usuários com `reminderShowAmount`, buscar ciclo existente do período (sem criar), calcular o valor diário e montar o texto com `buildReminderBody`
- [ ] 5.3 Testes de integração do cron: texto padrão com opção desativada, texto com valor quando `ok`, texto padrão sem ciclo e quando excedido, e cron não cria ciclo

## 6. Validação final
- [ ] 6.1 `pnpm test`, `pnpm test:integration` (branch `dev`), `tsc --noEmit`, `pnpm lint`, `pnpm build`
- [ ] 6.2 `openspec validate add-daily-allowance --strict`

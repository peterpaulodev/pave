## 1. Banco de dados
- [x] 1.1 Adicionar model `Event` ao `prisma/schema.prisma` (com relação em `User`), conforme design.md
- [x] 1.2 Gerar migration `usage_events` com `--create-only` _(migration `20261021181858_usage_events`)_
- [x] 1.3 Backfill no SQL: um `onboarding_completed` por linha de `user_settings` com `onboarded_at` não nulo, usando `onboarded_at` como `created_at`
- [x] 1.4 Mostrar o SQL para revisão e só aplicar na branch `dev` após confirmação; conferir `prisma migrate diff` vazio _(aplicada na `dev` com `migrate deploy`; `migrate diff` sem diferenças)_

## 2. Domínio e registro
- [x] 2.1 `lib/analytics/events.ts`: `EventMap` tipado e lista de nomes válidos _(a lista `EVENT_NAMES` é derivada de um objeto com `satisfies Record<EventName, true>`, então esquecer um evento nela é erro de tipo)_
- [x] 2.2 `lib/domain/metrics.ts`: `formatRatio(num, den)` ("3/5 · 60%", "—" com den 0) e `isAdmin(userId, envValue)` (espaços, vazio, ids repetidos) _(também exporta `parseAdminIds`, que a Seção 4 reaproveita para excluir admins das métricas)_
- [x] 2.3 Testes unitários de `formatRatio` e `isAdmin`
- [x] 2.4 `server/analytics.ts`: `trackEvent` tipado, executado em `after()`, erro capturado e logado _(`after()` é suportado em Server Actions e Route Handlers no Next desta versão — `node_modules/next/dist/docs/.../after.md`, estável desde 15.1; fora de request scope ele lança, e `trackEvent` captura isso também. Em Server Actions e Route Handlers `cookies()`/`headers()` funcionam dentro do callback, mas `trackEvent` não os usa. Em serverless depende de `waitUntil` (Vercel provê); em Node próprio, nada a configurar.)_
- [x] 2.5 Teste: `trackEvent` com falha de banco não lança erro para quem chamou _(`server/analytics.test.ts`, mocks sem banco; fica em `server/` porque o config raiz exclui `server/**`, então roda no `pnpm test:integration`. Há também `server/analytics-db.test.ts`, com escrita real e cascade na `dev`.)_

## 3. Instrumentação
- [x] 3.1 `completeOnboarding` → `onboarding_completed` _(só no primeiro envio: `completeOnboarding` ganhou `firstCompletion`; um duplo clique concorrente pode, em tese, gravar 2 eventos, o que não afeta a métrica por usuário)_
- [x] 3.2 `createExpense` → `expense_created` com `source` (zod enum, default `quick_entry`), `suggestedBucket` recalculado no servidor com `suggestBucket`, `overridden` _(`source` só aceita `quick_entry`/`notification`: qualquer outro valor, inclusive `recurring`, é rejeitado pelo zod; `suggestedBucket` enviado pelo cliente é ignorado)_
- [x] 3.3 Tela `/novo`: ler `src=notification` da URL e enviar `source` num campo hidden; no SW, a notificação abre `/novo?src=notification` _(a página lê `src` de `searchParams` e passa `source` como prop ao form, que o envia na chamada da action; não há `<form>` nativo, então não existe campo hidden. `DEFAULT_URL` do SW e `REMINDER_PAYLOAD.url` agora são `/novo?src=notification`; foco/autoFocus e o fallback não mudaram)_
- [x] 3.4 `applyRecurringToCycle` e "Lançar também neste mês" → um `expense_created` com `source: recurring` por gasto (em lote, `createMany`) _(`applyRecurringInTransaction` passou a devolver os baldes criados via `createManyAndReturn`; o evento é agendado após o commit, em `getOrCreateCycle` e `applyRecurringToCycle`; `createRecurringAction` com `alsoThisMonth` grava um `expense_created` recurring)_
- [x] 3.5 `deleteExpense` → `expense_deleted` com `wasRecurring` _(`removeExpense` devolve `wasRecurring`; o "Desfazer" do toast também chama `deleteExpense` e, portanto, gera `expense_deleted`)_
- [x] 3.6 `createRecurring` → `recurring_created`
- [x] 3.7 Ativar/desativar lembrete → `reminder_enabled` (com `hour`) / `reminder_disabled` _(só em transição: trocar o horário de um lembrete já ativo não gera evento)_
- [x] 3.8 Cron de lembretes → `reminder_sent` em lote para os usuários com envio bem-sucedido _(em `runReminderCron`, um `createMany` só para quem teve envio com sucesso)_
- [x] 3.9 `markNoSpend` → `no_spend_checkin` com `via` (`app` ou `notification`) _(`markNoSpend` passou a devolver se criou o check-in e só então grava o evento; repetir o mesmo dia não duplica)_
- [x] 3.10 Revisar todas as chamadas: nenhuma `props` com descrição, valor ou texto livre _(10 chamadas conferidas: só enums, booleanos e `hour`)_

## 4. Métricas
- [ ] 4.1 `server/metrics.ts`: as quatro métricas + usuários ativos em 7 dias + usuários com lembrete ativo, parametrizadas por janela e por lista de ids excluídos
- [ ] 4.2 Retenção na semana 2 conforme D6 (coorte com onboarding entre 14 e 44 dias atrás; registro manual ou dia sem gasto entre os dias 7 e 13)
- [ ] 4.3 Testes de integração com usuários e eventos sintéticos (datas controladas) para cada métrica, incluindo exclusão dos admins e denominador zero
- [ ] 4.4 Página `app/(app)/admin/page.tsx`: `notFound()` para não admin; seletor de janela 7/30/90 e toggle "Incluir meus dados" via search params; cards mobile-first com numerador, denominador e percentual
- [ ] 4.5 Teste: usuário comum recebe 404 em `/admin`

## 5. Validação final
- [ ] 5.1 Adicionar `ADMIN_USER_IDS` a `lib/env.ts` (opcional; ausente = ninguém é admin) e `.env.example`
- [ ] 5.2 `pnpm test`, `pnpm test:integration` (branch `dev`), `tsc --noEmit`, `pnpm lint`, `pnpm build`
- [ ] 5.3 Validar `/admin` em 390px com o bypass de dev
- [ ] 5.4 Listar o que configurar na Vercel
- [ ] 5.5 `openspec validate add-usage-analytics --strict`

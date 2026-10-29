## 0. Preparação
- [x] 0.1 Ler `openspec/specs/expense-entry/spec.md` (versão arquivada) e confirmar que o requirement "Lançamento rápido de gasto" tem exatamente esse nome; se tiver outro nome ou outros requirements que conflitem, ajustar o delta MODIFIED antes de implementar
- [x] 0.2 Confirmar `NEON_BRANCH=dev`, rodar `pnpm test` e `pnpm test:integration`

## 1. Domínio (TS puro, com testes)
- [x] 1.1 `lib/domain/amount-keypad.ts`: redutor (`digit`, `doubleZero`, `backspace`, `clear`, limite de 9 dígitos)
- [x] 1.2 Testes do redutor: sequência 1-2-0-0, `00`, apagar, limpar, limite, apagar em zero
- [x] 1.3 `lib/domain/entry-chips.ts`: `STARTER_CHIPS` e `buildEntryChips(history, starters, limit)`
- [x] 1.4 Testes: histórico completo, histórico parcial completado com iniciais, duplicata entre histórico e inicial, usuário novo
- [x] 1.5 `lib/domain/entry-impact.ts`: `previewImpact(context, draft)` conforme D5
- [x] 1.6 Testes: cada balde, Lazer hoje × data anterior, negativo ("acima do planejado"), valor zero, exemplos da spec
- [x] 1.7 `lib/domain/entry-date.ts`: `allowedDateRange(today)`, `isYesterdayAllowed(today)`, `isDateAllowed(date, today)`
- [x] 1.8 Testes: dia 1, meio do mês, último dia, data futura, mês anterior

## 2. Dados
- [x] 2.1 `server/entry-context.ts`: `getFrequentDescriptions(userId, limit)` em SQL agregado (gastos manuais, 90 dias, agrupado por descrição normalizada, balde do mais recente, ordenado por contagem e recência)
- [x] 2.2 `getEntryContext(userId)`: chips, disponível por balde, valor diário de lazer e `today` local, reaproveitando as queries existentes
- [x] 2.3 `createExpense`: validar `occurredOn` com `isDateAllowed` na data local do usuário; aceitar `usedChip`, `chipSource`, `durationMs` (zod; `durationMs` inválido é descartado sem falhar o gasto)
- [x] 2.4 Testes de integração: ordenação e agrupamento dos chips, exclusão de contas fixas e de outros usuários, janela de 90 dias, rejeição de data futura e de mês anterior, `durationMs` inválido

## 3. Componentes
- [x] 3.1 `components/bucket-meta.ts` + tokens CSS `--bucket-*` com variantes de modo escuro
- [x] 3.2 `amount-display` e `amount-keypad` (56px+, aria-labels, aria-live, pressionar e segurar para limpar, teclado físico, vibração respeitando movimento reduzido)
- [x] 3.3 `description-chips` com "Outro" (campo com autofoco, oculta o teclado de valor durante o foco, transfere valor do texto)
- [x] 3.4 `bucket-selector` com indicação "sugerido" / "como da última vez"
- [x] 3.5 `date-chips` com `<input type="date">` nativo em popover, `min`/`max` do mês atual
- [x] 3.6 `impact-line`
- [x] 3.7 `expense-entry` (composição, `variant`, botão "Salvar R$ X", estados de envio, erro e sucesso)

## 4. Rotas
- [x] 4.1 Slot `@sheet` no layout de `(app)` com `default.tsx`
- [x] 4.2 `app/(app)/@sheet/(.)novo/page.tsx` com o sheet (fechar = `router.back()`)
- [x] 4.3 `app/(app)/novo/page.tsx` em tela cheia, mantendo `src=notification`
- [x] 4.4 Botão flutuante do painel navega para `/novo` (abre o sheet)
- [x] 4.5 Remover a tela e os componentes antigos que ficarem sem uso (`parseQuickEntry` continua)

## 5. Analytics
- [x] 5.1 Estender `expense_created` no `EventMap` com `usedChip`, `chipSource`, `durationMs?`
- [ ] 5.2 `server/metrics.ts`: tempo mediano até salvar (`percentile_cont`) e proporção com chip (histórico × iniciais), com exclusão de admins
- [ ] 5.3 Cards novos no `/admin`
- [ ] 5.4 Testes de integração das duas métricas, incluindo eventos antigos sem `durationMs`

## 6. Validação
- [x] 6.1 E2E (Chromium, bypass de dev, `pnpm test:e2e`): abrir o sheet pelo painel → digitar valor → chip → salvar → toast → painel atualizado → "Desfazer"
- [x] 6.2 E2E: `/novo?src=notification` em tela cheia → salvar → "Lançar outro" mantém a data
- [x] 6.3 E2E: refresh com o sheet aberto abre a tela cheia; voltar fecha o sheet sem registrar
- [x] 6.4 Validação visual em 390px, claro e escuro: vazio, digitando, chip selecionado, "Outro" com teclado do sistema aberto, impacto acima do planejado, erro, sucesso
- [x] 6.5 `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `tsc --noEmit`, `pnpm lint`, `pnpm build`
- [x] 6.6 `openspec validate refactor-expense-entry --strict`

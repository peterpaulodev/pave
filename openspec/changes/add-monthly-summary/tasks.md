## 1. Banco de dados
- [x] 1.1 Adicionar `lastSummarySeenPeriod String? @map("last_summary_seen_period") @db.Char(7)` em `UserSettings`
- [x] 1.2 Gerar migration `last_summary_seen_period` com `--create-only`, mostrar o SQL e aplicar na `dev` após confirmação; conferir `prisma migrate diff` vazio

## 2. Domínio (TS puro, com testes)
- [x] 2.1 `lib/domain/period.ts`: `previousPeriod(period)` (janeiro → dezembro do ano anterior) e `periodLabel(period)` ("outubro") sem timezone
- [x] 2.2 Testes de `previousPeriod` e `periodLabel`
- [x] 2.3 Extrair a normalização de descrição de `suggest-bucket.ts` para função exportada reutilizável (sem mudar comportamento; testes existentes continuam passando)
- [x] 2.4 `lib/domain/monthly-summary.ts`: `buildMonthlySummary(input)` conforme D3 e D4 (baldes, guardado, contas fixas, top 3 de Lazer, dias registrados, destaque)
- [x] 2.5 Testes de `buildMonthlySummary`: cada regra de destaque e a ordem de prioridade, agrupamento do exemplo da spec ("iFood" R$ 100,00), menos de 2 gastos de Lazer omite a seção, mês incompleto (dia 15 → 17 dias), balde acima e abaixo do limite, `diffCents` zero

## 3. Dados
- [x] 3.1 `server/monthly-summary.ts`: `getSummaryEligibility(userId, previousPeriod)` conforme D1
- [x] 3.2 `getMonthlySummaryData(userId, period)` conforme D5: somas por balde e de contas fixas em uma query com `SUM ... FILTER`, gastos de Lazer do ciclo, dias registrados do período, data local de criação do ciclo
- [x] 3.3 Server Action `markSummarySeen(period)`: grava só se `period === previousPeriod` local; `userId` da sessão
- [x] 3.4 Testes de integração: elegibilidade (com atividade, só contas fixas, sem ciclo, já visto), soma por balde ignorando outros ciclos e outros usuários, dias registrados sem contar gasto automático, `markSummarySeen` ignorando período antigo

## 4. UI (spec: monthly-summary)
- [ ] 4.1 Painel: checar elegibilidade e redirecionar para `/resumo/[previousPeriod]?auto=1`
- [ ] 4.2 `app/(app)/resumo/[period]/page.tsx`: validação de `period` com zod; `notFound()` para inválido, atual, futuro ou sem ciclo do usuário
- [ ] 4.3 Tela mobile-first: destaque no topo, cards dos três baldes, "Você guardou", contas fixas, destinos do Lazer, dias registrados, aviso de mês incompleto
- [ ] 4.4 Botão "Começar [mês atual]" chama `markSummarySeen` e volta ao painel; em resumo de mês antigo, o botão é "Voltar"
- [ ] 4.5 Link "Ver resumo de [mês]" no painel nos dias 1 a 7, quando houver resumo do mês anterior
- [ ] 4.6 Validar em 390px com o bypass de dev: mês no azul, mês com estouro, mês incompleto, sem destinos de Lazer

## 5. Analytics
- [ ] 5.1 Adicionar `monthly_summary_viewed: { auto: boolean }` ao `EventMap`
- [ ] 5.2 Registrar ao renderizar `/resumo/[period]` com `trackEvent` em `after()`
- [ ] 5.3 Teste de integração: evento gravado com `auto` correto e sem outras props

## 6. Validação final
- [ ] 6.1 `pnpm test`, `pnpm test:integration` (branch `dev`), `tsc --noEmit`, `pnpm lint`, `pnpm build`
- [ ] 6.2 `openspec validate add-monthly-summary --strict`
- [ ] 6.3 Deploy antes de 1º de novembro

## Notas de implementação (seções 1–3)
Desvios e interpretações em relação ao design:
- **`all_within` e Investimentos:** "os três baldes dentro do limite" foi implementado como Necessidades e Lazer com `diffCents ≥ 0` e meta de guardar atingida (`savedCents ≥ savingsLimitCents`). Para Investimentos, "dentro do limite" literal exigiria guardar exatamente a meta; guardar mais é bom.
- **`first_month`:** segue D3 ao pé da letra (ciclo criado depois do dia 1, `startedOnDay != null`). Isso também vale para quem pulou meses e abriu o app no meio de um mês posterior, não só para o primeiro ciclo.
- **Destinos do Lazer:** entram todos os gastos de Lazer do ciclo, contas fixas inclusas (ex.: streaming). O nome exibido é a grafia mais frequente *sem números* ("iFood 45" → "iFood"), pois as descrições cruas quase nunca se repetem; empate fica com a primeira vista (ordem de `createdAt`).
- **Janela de dias (D4):** `cycleStartDate` fora do mês é limitada ao mês; datas registradas fora da janela são ignoradas.
- **`getRegisteredDates` refatorado:** o SQL foi movido para `queryRegisteredDates` (limites `since`/`until`), reaproveitado por `getRegisteredDates` (sem teto superior, `'infinity'`) e pelo novo `getRegisteredDatesBetween(from, to)`. Comportamento original preservado (testes existentes passam).
- **Normalização:** `normalize` de `suggest-bucket.ts` virou `normalizeText` (exportada, sem mudança de comportamento). Remoção de números/espaços fica em `monthly-summary.ts`.
- **Novos helpers em `period.ts`:** `daysInPeriod` (usa `resolveDueDate`, mesma regra de último dia do mês), além de `previousPeriod` e `periodLabel`.
- **`markSummarySeen`:** a lógica está em `markSummarySeenFor(userId, period, now)` (`server/monthly-summary.ts`, testável); `actions/summary.ts` só valida o formato, pega o `userId` da sessão e delega. Período diferente do mês anterior local é ignorado em silêncio.
- **Elegibilidade (D1):** até 3 consultas, na ordem ciclo → settings → atividade (`EXISTS`), parando na primeira que falhar.
- **Teste de mutação (3.x):** removida a condição de atividade em `getSummaryEligibility`; 4 testes falharam (só contas fixas, ciclo vazio, outro usuário, check-in de outro mês). Revertido.

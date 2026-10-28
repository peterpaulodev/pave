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
- [x] 4.1 Painel: checar elegibilidade e redirecionar para `/resumo/[previousPeriod]?auto=1`
- [x] 4.2 `app/(app)/resumo/[period]/page.tsx`: validação de `period` com zod; `notFound()` para inválido, atual, futuro ou sem ciclo do usuário
- [x] 4.3 Tela mobile-first: destaque no topo, cards dos três baldes, "Você guardou", contas fixas, destinos do Lazer, dias registrados, aviso de mês incompleto
- [x] 4.4 Botão "Começar [mês atual]" chama `markSummarySeen` e volta ao painel; em resumo de mês antigo, o botão é "Voltar"
- [x] 4.5 Link "Ver resumo de [mês]" no painel nos dias 1 a 7, quando houver resumo do mês anterior
- [x] 4.6 Validar em 390px com o bypass de dev: mês no azul, mês com estouro, mês incompleto, sem destinos de Lazer

## 5. Analytics
- [x] 5.1 Adicionar `monthly_summary_viewed: { auto: boolean }` ao `EventMap`
- [x] 5.2 Registrar ao renderizar `/resumo/[period]` com `trackEvent` em `after()`
- [x] 5.3 Teste de integração: evento gravado com `auto` correto e sem outras props

## 6. Validação final
- [x] 6.1 `pnpm test`, `pnpm test:integration` (branch `dev`), `tsc --noEmit`, `pnpm lint`, `pnpm build`
- [x] 6.2 `openspec validate add-monthly-summary --strict`
- [ ] 6.3 Deploy antes de 1º de novembro

## Notas de implementação (seções 1–3)
Desvios e interpretações em relação ao design:
- **`all_within` e Investimentos:** "os três baldes dentro do limite" foi implementado como Necessidades e Lazer com `diffCents ≥ 0` e meta de guardar atingida (`savedCents ≥ savingsLimitCents`). Para Investimentos, "dentro do limite" literal exigiria guardar exatamente a meta; guardar mais é bom.
- **`first_month`:** (revisado) vale só com ciclo iniciado depois do dia 1 **e** sem ciclo de período anterior (`hasEarlierCycle`, calculado na query agregada); quem já tinha ciclos cai em `default`. Ver D3.
- **Destinos do Lazer:** entram todos os gastos de Lazer do ciclo, contas fixas inclusas (ex.: streaming). O nome exibido é a grafia mais frequente *sem números* ("iFood 45" → "iFood"), pois as descrições cruas quase nunca se repetem; empate fica com a primeira vista (ordem de `createdAt`).
- **Janela de dias (D4):** `cycleStartDate` fora do mês é limitada ao mês; datas registradas fora da janela são ignoradas.
- **`getRegisteredDates` refatorado:** o SQL foi movido para `queryRegisteredDates` (limites `since`/`until`), reaproveitado por `getRegisteredDates` (sem teto superior, `'infinity'`) e pelo novo `getRegisteredDatesBetween(from, to)`. Comportamento original preservado (testes existentes passam).
- **Normalização:** `normalize` de `suggest-bucket.ts` virou `normalizeText` (exportada, sem mudança de comportamento). Remoção de números/espaços fica em `monthly-summary.ts`.
- **Novos helpers em `period.ts`:** `daysInPeriod` (usa `resolveDueDate`, mesma regra de último dia do mês), além de `previousPeriod` e `periodLabel`.
- **`markSummarySeen`:** a lógica está em `markSummarySeenFor(userId, period, now)` (`server/monthly-summary.ts`, testável); `actions/summary.ts` só valida o formato, pega o `userId` da sessão e delega. Período diferente do mês anterior local é ignorado em silêncio.
- **Elegibilidade (D1):** até 3 consultas, na ordem ciclo → settings → atividade (`EXISTS`), parando na primeira que falhar.
- **Teste de mutação (3.x):** removida a condição de atividade em `getSummaryEligibility`; 4 testes falharam (só contas fixas, ciclo vazio, outro usuário, check-in de outro mês). Revertido.

## Notas de implementação (seções 4–6)
- **Cores:** `lib/domain/buckets.ts` só exporta rótulos e proporções (não há cores de balde); a tela usa `BUCKET_LABELS`/`BUCKET_ORDER` e os tokens neutros do tema. Estouro aparece como texto ("R$ X acima do planejado"), sem `destructive`.
- **Botão:** "Começar [mês atual]" só quando `auto=1` **e** o período é o mês anterior; em qualquer outro caso, "Voltar". Abrir o mês anterior pelo link do painel (sem `auto`) mostra "Voltar" e não grava nada.
- **Evento:** `auto` é `true` só com `?auto=1` no mês anterior; `?auto=1` forjado em mês antigo grava `false`.
- **Contas fixas:** o card é omitido quando o total é zero (a spec exige o total quando há contas fixas).
- **Link no painel:** `canShowSummaryLink(today)` (dias 1–7 locais) + existência de ciclo do mês anterior; `prefetch={false}` para a visita ao resumo não ser contada por prefetch.
- **Redirect:** feito em `PainelPage` antes de criar o ciclo do mês novo e de qualquer consulta do painel; `/novo` não tem redirect (coberto por teste).
- **Testes de página:** `server/summary-page.test.ts` chama as páginas reais com sessão, `notFound`/`redirect` e `after()` substituídos; cobre o 404 do período de outro usuário, inválido, atual, futuro e sem ciclo.
- **4.6 (390px):** validado com `next dev` + `DEV_AUTH_BYPASS_USER_ID` (só por variável de ambiente), Chromium headless em 390px, dados semeados no banco de teste com ciclo do mês anterior real (2026-09), sem mexer no relógio: mês no azul, com estouro, incompleto (início dia 15) e sem destinos de Lazer. Usuário, ciclos e eventos de teste removidos depois. O clique em "Começar [mês]" não foi exercitado no navegador (a gravação é coberta por `markSummarySeenFor` nos testes de integração).
- **6.3** fica em aberto: o deploy é manual.

## Ajustes pré-deploy
- **Failsafe:** "Começar [mês]" navega para `/?summary=seen` mesmo se `markSummarySeen` falhar (try/catch no botão); o painel não redireciona nesse request. O parâmetro vale só para ele, e só o valor exato `seen`. Teste de integração com `markSummarySeenFor` falhando por mock.
- **E2E (`pnpm test:e2e`):** `e2e/monthly-summary.test.ts` sobe `next dev -p 3100` com o bypass, semeia usuário + ciclo do mês anterior com atividade e dirige o Chromium (390px) por `playwright-core@1.62.1` (nova devDependency, sem download de browser: usa o Chromium já em `~/.cache/ms-playwright`). Fluxo: painel → redirect → "Começar" → painel → recarga sem novo redirect → `last_summary_seen_period` gravado. Limpa servidor e dados no fim; fora do `pnpm test`. Precisa da porta 3100 livre e nenhum outro `next dev` neste diretório. Mutação (removendo a gravação no botão) faz o teste falhar.
- **`all_within` e `first_month`:** design.md D3 e a spec foram alinhados ao comportamento implementado (esta última também ganhou o cenário "Mês incompleto de quem já tinha ciclos").

# Design

## Context
Cada mês é um `BudgetCycle` (período `YYYY-MM`) com limites congelados dos três
baldes; gastos pertencem ao ciclo por `cycleId`. Gastos de conta fixa têm
`recurringExpenseId`; dias registrados vêm de gastos manuais e de `DailyCheckin`
(`getRegisteredDates`). O analytics registra eventos tipados por `EventMap` via
`trackEvent` em `after()`.

Este change lê o ciclo anterior e apresenta um fechamento, sem alterar como os
ciclos são criados.

## Goals / Non-Goals

**Goals**
- Mostrar o fechamento do mês anterior uma vez, no primeiro acesso do novo mês
- Linguagem simples e positiva, sem julgamento, para quem está começando
- Permitir rever o resumo depois

**Non-Goals**
- Comparação mês a mês e tendências
- Gráficos
- Push no dia 1 avisando que o resumo está pronto (ver Open Questions)
- Compartilhar o resumo como imagem

## Decisions

### D1 — Quando o resumo aparece
- Ao abrir o painel, o servidor calcula `previousPeriod` a partir da data local do
  usuário (`localDate(tz)`) e verifica:
  1. existe `BudgetCycle` do usuário para `previousPeriod`;
  2. o ciclo tem **atividade**: ao menos um gasto manual ou um `DailyCheckin` no mês;
  3. `UserSettings.lastSummarySeenPeriod` é diferente de `previousPeriod`.
- Se as três forem verdadeiras, o painel redireciona para
  `/resumo/[previousPeriod]?auto=1`.
- Ciclo sem atividade (só contas fixas automáticas ou nada) não gera resumo
  automático: não há hábito para mostrar.
- Usuário que pulou um mês inteiro (sem ciclo no mês anterior) não vê resumo
  automático.
- **Por que redirecionar em vez de modal:** a tela de resumo é a mesma usada para
  rever meses anteriores, tem URL própria e não precisa conviver com o painel.

### D2 — Marcar como visto
- A tela `/resumo/[period]` tem o botão "Começar novembro" (nome do mês atual).
  O toque grava `lastSummarySeenPeriod = period` via Server Action e volta ao painel.
- Abrir o resumo **não** marca como visto sozinho: se o usuário fechar o app antes
  do botão, o resumo aparece de novo no próximo acesso.
- Só marca quando `period === previousPeriod` (rever meses antigos não mexe no campo).
- Campo único em `UserSettings` em vez de tabela: só interessa o último período visto.

### D3 — Conteúdo do resumo
Função pura `buildMonthlySummary(input): MonthlySummary` em
`lib/domain/monthly-summary.ts`. Entrada: limites do ciclo, somas por balde, somas
de contas fixas por balde, gastos de Lazer (descrição e valor), dias registrados,
dias do mês considerados, data de início e se o usuário tem algum ciclo de período
anterior (`hasEarlierCycle`).

Saída:
- **Por balde:** `limitCents`, `spentCents`, `diffCents` (`limit − spent`; positivo
  = abaixo do limite).
- **Investimentos:** apresentado como `savedCents` (soma dos gastos do balde) frente
  à meta (`savingsLimitCents`). Texto: "Você guardou R$ X de R$ Y".
- **Contas fixas:** total do mês e quanto do balde de Necessidades elas ocuparam.
- **Dias registrados:** `registeredDays` de `trackedDays`.
- **Lazer por destino:** top 3 grupos por soma, agrupando por descrição normalizada
  (minúsculas, sem acento, sem números e espaços extras), reaproveitando a
  normalização de `suggest-bucket.ts`. O nome exibido é a descrição mais frequente
  do grupo. Menos de 2 gastos de Lazer: seção omitida.
- **Destaque:** um único, pela primeira regra que se aplicar:
  1. `all_within`: Necessidades e Lazer dentro do limite e `savedCents ≥ savingsLimitCents`
     (Investimentos é meta, não teto: guardar além do limite é bom, então ele entra pela
     meta e não pela regra "dentro do limite")
     → "Mês fechado no azul: todos os baldes dentro do planejado."
  2. `saved_goal`: meta de investimento atingida → "Você bateu a meta de guardar 20%."
  3. `wants_within`: Lazer dentro do limite → "Seu lazer coube no planejado, com R$ X de folga."
  4. `consistent`: `registeredDays / trackedDays ≥ 0.7` → "Você registrou em N dos M dias. É assim que o controle funciona."
  5. `first_month`: ciclo começou depois do dia 1 **e** o usuário não tem nenhum ciclo de
     período anterior (`hasEarlierCycle` falso) → "Primeiro mês concluído. Agora você
     sabe para onde vai seu dinheiro." Quem já tinha ciclos e só começou o mês tarde não
     está no primeiro mês: cai na regra 6.
  6. `default` → "Mês fechado. Cada mês registrado deixa o próximo mais fácil."
- **Tom:** estouro de balde é mostrado como fato ("R$ 120 acima do planejado"), sem
  vermelho de alerta e sem frases de culpa.

### D4 — Mês incompleto
- Se o ciclo foi criado depois do dia 1 (onboarding no meio do mês), `trackedDays`
  conta da data de criação do ciclo (local) até o fim do mês, e o resumo exibe
  "desde que você começou, no dia N".
- Os limites continuam os do ciclo (integrais), como no painel.

### D5 — Dados
`server/monthly-summary.ts`:
- `getSummaryEligibility(userId, previousPeriod)` → `{ cycleId } | null` aplicando
  D1 (ciclo existe, tem atividade, não visto), em uma ida ao banco por condição no
  máximo.
- `getMonthlySummaryData(userId, period)` → entrada de `buildMonthlySummary`:
  - somas por balde e somas de conta fixa por balde em uma query (`SUM ... FILTER`);
  - gastos de Lazer `{ description, amountCents }` do ciclo;
  - `hasEarlierCycle` (existe ciclo do usuário com período anterior), na mesma query das somas;
  - dias registrados no mês reaproveitando a lógica de `getRegisteredDates`
    (gastos manuais por `created_at` local + `daily_checkins`), filtrados ao período.
- Tudo escopado por `userId`; período de outro usuário → `notFound()`.

### D6 — Rotas e navegação
- `app/(app)/resumo/[period]/page.tsx`: valida `period` (`^\d{4}-(0[1-9]|1[0-2])$`)
  com zod; período inválido, futuro, atual ou sem ciclo do usuário → `notFound()`.
- Painel: nos dias 1 a 7 do mês, se existir resumo do mês anterior, mostra o link
  "Ver resumo de outubro".
- Formatação do nome do mês com `Intl.DateTimeFormat('pt-BR', { month: 'long' })`
  sobre o período (data "pura", sem timezone).

### D7 — Analytics
- Novo evento no `EventMap`: `monthly_summary_viewed: { auto: boolean }`.
- Sem período, valores ou destaque nas props, seguindo a regra de privacidade.
- Registrado ao renderizar `/resumo/[period]` (via `trackEvent` em `after()`).

## Data Model

```prisma
// UserSettings: novo campo
//   lastSummarySeenPeriod String? @map("last_summary_seen_period") @db.Char(7)
```

## Risks / Trade-offs
- **Redirect no painel atrasa o primeiro acesso do mês** → a checagem é leve (uma
  linha de settings + existência do ciclo anterior); só redireciona uma vez por mês.
- **Usuário que acessa direto `/novo` no dia 1** (pela notificação) → não vê o
  resumo nesse momento; ele aparece no próximo acesso ao painel. Aceitável: não
  interromper um lançamento.
- **Agrupamento por descrição imperfeito** ("ifood" vs "i food") → aceitável no v1;
  as métricas de sugestão já indicam termos para normalizar.
- **Investimentos registrados como "gasto"** → o texto "guardou" corrige o modelo
  mental sem mudar o modelo de dados.

## Migration Plan
1. `prisma migrate dev --create-only --name last_summary_seen_period` → revisar →
   aplicar na `dev`
2. Deploy antes de 1º de novembro; nenhuma env nova

## Open Questions
- Enviar push no dia 1 ("Seu resumo de outubro está pronto") reaproveitando o cron
  de lembretes? Proposta: avaliar depois de ver quantos usuários abrem o resumo.

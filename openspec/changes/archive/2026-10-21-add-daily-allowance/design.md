# Design

## Context
O painel já exibe, por balde, limite, gasto e disponível do ciclo, com contas fixas
(inclusive agendadas) descontadas do disponível. O lembrete diário é enviado pelo
cron horário (GitHub Actions → `POST /api/cron/reminders`) com texto fixo.

Este change acrescenta um valor diário para o balde de Lazer, calculado a partir
dos dados existentes, sem novas tabelas.

## Goals / Non-Goals

**Goals**
- Responder "quanto posso gastar com lazer hoje?" com um único número
- Número estável ao longo do dia: gastar hoje reduz o "resta hoje", não recalcula
  o valor do dia
- Exceder hoje reduz automaticamente o valor dos dias seguintes

**Non-Goals**
- Valor diário para Necessidades (dominado por contas fixas) e Investimentos
  (não é gasto do dia a dia)
- Distribuição ponderada (fim de semana valendo mais etc.)
- Notificação ao exceder o valor do dia

## Decisions

### D1 — Fórmula
Para o balde Lazer (`wants`) no ciclo atual, com `today` na data local do usuário:

- `committedCents` = soma dos gastos de Lazer do ciclo **exceto** os manuais com
  `occurredOn = today`. Inclui: manuais de dias anteriores (inclusive retroativos)
  e todos os de conta fixa, de qualquer data (já comprometidos, como no painel).
- `spentTodayCents` = soma dos gastos manuais de Lazer com `occurredOn = today`.
- `startOfDayCents` = `max(0, wantsLimitCents − committedCents)`.
- `daysLeft` = dias do mês de `today` até o último dia, incluindo hoje (≥ 1).
- `allowanceCents` = `floor(startOfDayCents / daysLeft)`.
- `remainingTodayCents` = `allowanceCents − spentTodayCents` (pode ser negativo).

**Por que "início do dia":** se o valor fosse recalculado a partir do saldo atual,
gastar R$ 30 hoje com valor diário de R$ 42 reduziria o valor de hoje para
~R$ 41 em vez de mostrar "resta R$ 12". O usuário precisa ver o efeito do gasto.

Gasto manual lançado com data futura (raro) entra em `committedCents`, como conta
agendada.

### D2 — Função pura
`lib/domain/daily-allowance.ts`:

```ts
export type DailyAllowance = {
  allowanceCents: number;
  spentTodayCents: number;
  remainingTodayCents: number;
  daysLeft: number;
  status: 'ok' | 'over_today' | 'bucket_exhausted';
};

export function computeDailyAllowance(input: {
  wantsLimitCents: number;
  committedCents: number;
  spentTodayCents: number;
  today: string;   // 'YYYY-MM-DD' local
}): DailyAllowance;
```

- `bucket_exhausted`: `startOfDayCents === 0`.
- `over_today`: `remainingTodayCents < 0` e o balde não está esgotado.
- `ok`: demais casos.
- `daysLeft` calculado a partir de `today` (último dia do mês com a mesma lógica de
  `resolveDueDate`), sem `Date` com timezone.

### D3 — Query
`server/daily-allowance.ts`: `getDailyAllowanceInputs(userId, cycleId, today)`
retorna `wantsLimitCents`, `committedCents` e `spentTodayCents` em **uma** query
agregada (`SUM` com `FILTER`), escopada por `userId`.

### D4 — UI no painel
- Card acima dos baldes: "Hoje você pode gastar **R$ 42** com lazer".
- Linha de apoio: "Já gastou R$ 15 · resta R$ 27".
- `over_today`: "Você passou R$ 8 do valor de hoje. Amanhã o valor diário se ajusta."
  Tom informativo, sem alarme.
- `bucket_exhausted`: "O lazer deste mês acabou. Ele volta no dia 1." O card do
  balde de Lazer continua mostrando o valor excedido, como hoje.
- Toque no valor abre uma explicação: "Pegamos o que sobra de lazer no mês e
  dividimos pelos N dias que faltam, contando hoje."
- No último dia do mês, `daysLeft = 1` e o texto vira "Último dia do mês: R$ X de lazer".

### D5 — Valor no lembrete
- Novo campo `UserSettings.reminderShowAmount Boolean @default(false)`.
- **Desativado por padrão:** a notificação aparece na tela de bloqueio, e valor
  financeiro visível pode incomodar. O usuário ativa em Configurações
  ("Mostrar quanto sobra de lazer no lembrete").
- Com a opção ativa e status `ok`: "Você ainda tem R$ 27 de lazer hoje. Gastou algo?"
- Com a opção ativa e status `over_today` ou `bucket_exhausted`, ou sem ciclo no
  período: texto padrão atual ("Gastou algo hoje? Leva 5 segundos para registrar.").
- O cron **não cria ciclo**: se o usuário não tem ciclo no período atual, usa o
  texto padrão.
- Montagem do texto em função pura `buildReminderBody(allowance | null, showAmount)`
  em `lib/domain/reminder-text.ts`.

## Data Model

```prisma
// UserSettings: novo campo
//   reminderShowAmount Boolean @default(false) @map("reminder_show_amount")
```

## Risks / Trade-offs
- **Gasto retroativo muda o valor do dia** (entra em `committedCents`) → correto
  financeiramente; o valor de hoje cai após lançar um gasto de ontem.
- **Renda editada no meio do mês** → o limite do ciclo muda e o valor diário se
  ajusta no próximo cálculo; nenhum tratamento especial.
- **Usuário pode tratar o valor diário como meta de gasto** → a explicação deixa
  claro que é um teto, não um alvo.
- **Cron calcula por usuário** → uma query agregada a mais por usuário a lembrar;
  irrelevante no volume atual.

## Migration Plan
1. `prisma migrate dev --create-only --name reminder_show_amount` → revisar → aplicar na `dev`
2. Deploy; nenhuma env nova

## Open Questions
- Mostrar também um valor diário opcional para Necessidades (sem contas fixas)? Proposta: não, até as métricas indicarem demanda.

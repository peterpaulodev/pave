# Design

## Context
O MVP (`add-mvp-503020`, arquivado) está em produção: Next.js App Router na raiz
(`app/`, `lib/`, `server/`), Prisma 7 + adapter Neon, Neon Auth com usuário
espelhado em `public.user` (`ensureMirroredUser`), PWA com `@serwist/turbopack`.

Este change adiciona contas fixas recorrentes e um lembrete diário por Web Push,
sem alterar o fluxo de onboarding nem o lançamento rápido existente.

## Goals / Non-Goals

**Goals**
- Contas fixas lançadas automaticamente em cada ciclo, exatamente uma vez
- Lembrete diário que respeita o horário e o timezone do usuário
- Lembrete não enviado quando o usuário já registrou algo no dia
- Contador de dias seguidos que conta gastos **e** dias sem gasto

**Non-Goals**
- Lembrete de vencimento de conta (ex.: "luz vence amanhã")
- Parcelas com número de meses definido (MVP: recorrência indefinida)
- Notificação por e-mail/WhatsApp
- Recorrência semanal/anual

## Decisions

### D1 — Modelo de conta fixa (template)
- `RecurringExpense` é um template: `description`, `amountCents`, `bucket`,
  `dayOfMonth` (1–31), `active`.
- Dia maior que o último dia do mês cai no último dia (31 → 30/04, 28 ou 29/02).
  Função pura `resolveDueDate(period, dayOfMonth): string` em `lib/domain/recurring.ts`.
- Editar o template afeta apenas ciclos futuros. Gastos já lançados não mudam.
- Excluir/pausar o template não remove gastos já lançados.
- **Exclusão é soft delete** (`deletedAt` + `active = false`): o template some da
  listagem e não é mais aplicado, mas os gastos já lançados mantêm o vínculo
  (`recurringExpenseId`) e, portanto, o selo "Fixa" e a soma "em contas fixas". A FK
  `ON DELETE SET NULL` só agiria numa exclusão física, que o app não faz.

### D2 — Materialização no ciclo, uma única vez
- Ao criar um ciclo (`getOrCreateCycle`), as contas fixas ativas viram `Expense`
  com `recurringExpenseId` preenchido e `occurredOn` = data de vencimento no mês.
- Controle por `BudgetCycle.recurringAppliedAt`: a aplicação só roda se for `null`,
  e grava o timestamp na mesma `$transaction`.
- **Por que não unique `(recurringExpenseId, cycleId)` como controle:** se o usuário
  excluir um lançamento automático naquele mês, a unique permitiria recriá-lo na
  próxima chamada. O carimbo no ciclo garante "aplica uma vez e respeita exclusões".
- A unique `(recurringExpenseId, cycleId)` existe **também**, como proteção contra
  duplicidade em concorrência (dois requests criando o mesmo ciclo); usar
  `createMany({ skipDuplicates: true })`.
- Ciclos criados **antes** deste change têm `recurringAppliedAt = null`. Para não
  lançar retroativamente no mês atual em produção, a migration preenche
  `recurringAppliedAt = now()` em todos os ciclos existentes.

### D3 — Conta fixa cadastrada no meio do mês
- O formulário tem "Lançar também neste mês", **marcado por padrão** quando o
  vencimento ainda não passou e desmarcado quando já passou (o usuário
  provavelmente já lançou manualmente).
- Se marcado, cria o `Expense` do ciclo atual na mesma transação do template.

### D4 — Lançamentos automáticos no painel
- Gastos futuros (vencimento depois de hoje) entram no saldo como **comprometidos**:
  o dinheiro já está reservado. Na lista, aparecem com selo "Agendado" e data.
- Gastos de conta fixa aparecem com selo "Fixa" e podem ser excluídos ou editados
  só naquele mês (edição altera o `Expense`, não o template).
- O card de cada balde mostra "R$ X em contas fixas" quando houver.

### D5 — Web Push
- Biblioteca `web-push` no servidor, chaves VAPID em env
  (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:...`).
- `PushSubscription` por dispositivo (`endpoint` unique, `p256dh`, `auth`, `userId`).
  Um usuário pode ter vários dispositivos.
- Inscrição via Server Action `savePushSubscription(subscription)`; `userId`
  sempre da sessão.
- Envio que retorna **404/410** remove a subscription (expirada/revogada).
- Service worker (`app/sw.ts`) ganha handlers:
  - `push`: exibe notificação com título, corpo e `data.url`
  - `notificationclick`: foca uma janela existente do app ou abre `data.url`
    (`/novo`)

### D6 — Quando pedir permissão
- **Nunca** no carregamento. Pedido aparece após o **primeiro gasto salvo**, como
  card não bloqueante: "Quer um lembrete diário para não esquecer?".
- `Notification.requestPermission()` só dentro do clique do usuário (exigência do iOS).
- No iOS, push só funciona com o PWA instalado (iOS 16.4+). Fora do modo standalone,
  o card mostra a instrução de instalação em vez do botão de ativar.
- Recusa ou "Agora não" não pede de novo por 7 dias (`localStorage`, com try/catch).
  Permissão negada no navegador: card some e configurações mostram como reativar.

### D7 — Agendamento do envio
- Endpoint `app/api/cron/reminders/route.ts`, protegido por
  `Authorization: Bearer ${CRON_SECRET}`.
- Roda **a cada hora, no minuto 0**. Para cada usuário com lembrete ativo, calcula a
  hora local (`Intl.DateTimeFormat` com o `timezone` do usuário); envia se a hora
  local for igual a `reminderHour` e não houver gasto nem check-in na data local.
- Idempotência: `UserSettings.lastReminderSentOn` (date). Não envia duas vezes no
  mesmo dia local, mesmo se o cron disparar duplicado.
- **Agendador (decisão): GitHub Actions**, grátis e sem depender do plano da Vercel
  (Vercel Cron em frequência horária exige Pro). O workflow
  `.github/workflows/reminders-cron.yml` roda com `schedule: cron: '7 * * * *'`
  (minuto 7 para fugir do pico do minuto 0; a comparação é por hora local, então o
  minuto não importa) e `workflow_dispatch` para teste manual. Faz um
  `curl -fsS --max-time 60 -X POST "$APP_URL/api/cron/reminders"` com
  `Authorization: Bearer $CRON_SECRET` e `timeout-minutes: 5`.
- O endpoint aceita **POST** e responde JSON `{ checked, sent, removedSubscriptions }`
  (usuários avaliados, usuários notificados, inscrições expiradas removidas).
  `/api/cron` fica fora do matcher do `proxy.ts`: sem isso o middleware do Neon Auth
  responderia 307 para `/login` e o `curl -f` reportaria sucesso sem enviar nada.
- O envio é *at-most-once* por dia local: antes de enviar, o servidor reivindica o dia
  com `updateMany ... lastReminderSentOn <> hoje`. Se todas as tentativas falharem por
  motivo transitório, o lembrete daquele dia se perde (aceitável).
- `reminderHour` inteiro 0–23, default `20`. Opções na UI: 18h a 23h.

### D8 — Dias seguidos e "Não gastei nada hoje"
- `DailyCheckin(userId, date)` com unique `(userId, date)`: registra dia sem gasto.
- Dia "registrado" = existe `Expense` com `createdAt` naquela data local
  **ou** `DailyCheckin` naquela data. Gastos automáticos de conta fixa
  **não contam** (não refletem hábito).
- Streak = dias registrados consecutivos terminando hoje; se hoje ainda não foi
  registrado, termina ontem (o contador não zera às 00h).
- Cálculo em função pura `computeStreak(dates: string[], today: string): number`
  em `lib/domain/streak.ts`; a query traz as datas distintas dos últimos 60 dias.
- Notificação traz ação "Não gastei nada" quando o navegador suporta `actions`
  (Chrome/Android); no iOS o botão fica dentro do app.

## Data Model

```prisma
model RecurringExpense {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id")
  description String
  amountCents Int      @map("amount_cents")   // CHECK > 0
  bucket      Bucket
  dayOfMonth  Int      @map("day_of_month")   // CHECK 1..31
  active      Boolean  @default(true)
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz(6)  // soft delete (D1)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expenses Expense[]

  @@index([userId, active])
  @@map("recurring_expenses")
}

// Expense: novos campos
//   recurringExpenseId String?  @map("recurring_expense_id") @db.Uuid
//   recurringExpense   RecurringExpense? @relation(fields: [recurringExpenseId], references: [id], onDelete: SetNull)
//   @@unique([recurringExpenseId, cycleId])

// BudgetCycle: novo campo
//   recurringAppliedAt DateTime? @map("recurring_applied_at") @db.Timestamptz(6)

// UserSettings: novos campos
//   reminderEnabled    Boolean   @default(false) @map("reminder_enabled")
//   reminderHour       Int       @default(20)    @map("reminder_hour")     // CHECK 0..23
//   lastReminderSentOn DateTime? @map("last_reminder_sent_on") @db.Date

model PushSubscription {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id")
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?  @map("user_agent")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_subscriptions")
}

model DailyCheckin {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id")
  date      DateTime @db.Date
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@map("daily_checkins")
}
```

SQL adicional na migration (`--create-only`):
```sql
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_amount_positive" CHECK ("amount_cents" > 0);
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_day_range" CHECK ("day_of_month" BETWEEN 1 AND 31);
ALTER TABLE "user_settings" ADD CONSTRAINT "reminder_hour_range" CHECK ("reminder_hour" BETWEEN 0 AND 23);
-- não aplicar contas fixas retroativamente em ciclos existentes
UPDATE "budget_cycles" SET "recurring_applied_at" = now() WHERE "recurring_applied_at" IS NULL;
```

## Estrutura de arquivos (novos)

```
app/
  (app)/contas-fixas/page.tsx        # lista + formulário
  (app)/configuracoes/page.tsx       # lembrete: ativar, horário
  api/cron/reminders/route.ts        # envio horário
  sw.ts                              # + handlers push/notificationclick
lib/
  domain/
    recurring.ts                     # resolveDueDate(), isDuePassed()
    streak.ts                        # computeStreak()
    local-date.ts                    # localDate(tz), localHour(tz)
  push/
    web-push.ts                      # setVapidDetails + sendToUser()
    client.ts                        # subscribe() no navegador
server/
  recurring.ts                       # CRUD + applyRecurringToCycle()
  reminders.ts                       # findUsersToRemind(nowUtc)
actions/
  recurring.ts
  push.ts                            # savePushSubscription, removePushSubscription
  checkin.ts                         # markNoSpendToday
.github/workflows/reminders-cron.yml # se o agendador for GitHub Actions
```

## Risks / Trade-offs
- **Push no iOS depende do PWA instalado** → card de opt-in mostra instrução de
  instalação fora do modo standalone; sem instalar, o usuário fica sem lembrete.
- **GitHub Actions atrasa o schedule** (pode rodar com minutos de atraso) → aceitável
  para lembrete diário; a comparação é por hora local, não por minuto.
- **Cron duplicado ou atrasado cruzando a hora** → `lastReminderSentOn` impede
  envio duplo; atraso que cruza a hora faz perder o lembrete daquele dia (aceitável).
- **Gasto automático no dia 1 confunde o iniciante** ("eu não gastei isso!") →
  selos "Fixa" e "Agendado" e texto explicativo na primeira vez que aparecerem.
- **Conta fixa duplicada com lançamento manual** no mês do cadastro → default
  inteligente do "Lançar também neste mês" (D3).
- **Muitos usuários no cron** → query filtra por `reminderEnabled` e só traz quem
  não registrou hoje; envio em lotes com `Promise.allSettled`. Suficiente para o
  volume atual.

## Migration Plan
1. `npx prisma migrate dev --create-only --name recurring_and_reminders`
2. Adicionar CHECKs e o `UPDATE` de `recurring_applied_at` no SQL; revisar
3. Aplicar na branch `dev`; rodar `test:integration`
4. Produção: `prisma migrate deploy` (já no build com `VERCEL_ENV=production`)
5. Gerar VAPID (`npx web-push generate-vapid-keys`) e configurar envs + `CRON_SECRET`
   na Vercel (Production e Preview) e, no GitHub, os secrets `CRON_SECRET` e `APP_URL`
   (URL de produção, sem barra final) do workflow

## Open Questions
- ~~Agendador: Vercel Cron (Pro) ou GitHub Actions (grátis)?~~ **Decidido: GitHub Actions** (D7).
- Oferecer "Adicionar contas fixas" como passo opcional logo após o onboarding,
  ou só pelo painel/estado vazio?
- Horário do lembrete: só 18h–23h ou qualquer hora?

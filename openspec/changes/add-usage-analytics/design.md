# Design

## Context
App em produção com MVP + contas fixas + lembrete diário. Stack: Next.js App
Router na raiz (`app/`, `lib/`, `server/`, `actions/`), Prisma 7 + adapter Neon,
Neon Auth com usuário espelhado em `public.user`, cron de lembretes via GitHub
Actions chamando `POST /api/cron/reminders`.

O objetivo é medir uso com o mínimo de infraestrutura: uma tabela de eventos no
mesmo banco e uma página interna com quatro números.

## Goals / Non-Goals

**Goals**
- Registrar os eventos que respondem às quatro perguntas do produto
- Zero impacto na experiência: falha de registro nunca aparece para o usuário
- Nenhum dado financeiro sensível (descrição, valor) nos eventos
- Página de métricas simples, só para o dono do app

**Non-Goals**
- Ferramentas externas de analytics
- Pageviews, cliques, sessões
- Gráficos e séries temporais (números agregados bastam com poucos usuários)
- Backfill de eventos anteriores ao deploy

## Decisions

### D1 — Tabela `Event` no Postgres
- Colunas: `id`, `userId`, `name`, `props` (`Json`), `createdAt`.
- `name` é `String` no banco, mas o código só aceita nomes de um union literal em
  `lib/analytics/events.ts`, com o tipo de `props` de cada evento:

  ```ts
  export type EventMap = {
    onboarding_completed: Record<string, never>;
    expense_created: {
      source: 'quick_entry' | 'notification' | 'recurring';
      bucket: Bucket;
      suggestedBucket: Bucket | null;
      overridden: boolean;          // usuário trocou o balde sugerido
    };
    expense_deleted: { wasRecurring: boolean };
    recurring_created: { bucket: Bucket; alsoThisMonth: boolean };
    reminder_enabled: { hour: number };
    reminder_disabled: Record<string, never>;
    reminder_sent: Record<string, never>;
    no_spend_checkin: { via: 'app' | 'notification' };
  };
  ```
- **Por que não ferramenta externa:** volume pequeno, nenhum dado sai do banco,
  nenhum script de terceiro no PWA, e as métricas cruzam com dados que já temos.
- Índices: `(name, createdAt)` para agregações e `(userId, createdAt)` para retenção.

### D2 — `trackEvent` não bloqueia
- `server/analytics.ts`:
  `trackEvent<N extends keyof EventMap>(userId, name: N, props: EventMap[N])`.
- Chamado dentro de `after()` (`next/server`) nas Server Actions e rotas: a
  escrita acontece depois da resposta ser enviada.
- Erro de escrita é capturado e logado (`console.error`), nunca propagado.
- No cron, `reminder_sent` é gravado em lote com `createMany` ao final da execução.

### D3 — Origem do gasto
- `quick_entry`: lançamento manual pela tela `/novo`.
- `notification`: a notificação abre `/novo?src=notification`; a página repassa
  `source` num campo hidden. O valor do cliente é validado com zod (`enum`) e só
  serve para métricas, então aceitar do cliente é seguro.
- `recurring`: gastos criados por `applyRecurringToCycle` e pelo
  "Lançar também neste mês" — um evento por gasto, com `suggestedBucket: null`.
- Gastos `recurring` **não** entram nas métricas de atrito (D6); são registrados
  só para totalização.

### D4 — Privacidade
- `props` MUST NOT conter descrição, valor, renda nem texto livre do usuário.
- `Event` tem `onDelete: Cascade` em `userId`: excluir o usuário remove os eventos.
- Sem retenção automática por enquanto; o volume é pequeno. Reavaliar acima de
  ~1M linhas.

### D5 — Acesso ao `/admin`
- `ADMIN_USER_IDS` (lista separada por vírgula de ids do Neon Auth).
- `app/(app)/admin/page.tsx` verifica a sessão; usuário fora da lista recebe
  `notFound()` (404), sem revelar que a página existe.
- Link para `/admin` não aparece na navegação; acesso só pela URL.
- Parsing da env em função pura `isAdmin(userId, envValue)` com testes.

### D6 — Métricas
Janela padrão: últimos 30 dias (seletor 7 / 30 / 90). Todas mostram numerador,
denominador e percentual (`3/5 · 60%`), porque com poucos usuários o percentual
sozinho engana.

1. **Conclusão do onboarding** — usuários com `onboarding_completed` na janela ÷
   usuários criados (`user.createdAt`) na janela.
2. **Retenção na semana 2** — dos usuários que concluíram o onboarding entre 14 e
   44 dias atrás (coorte com semana 2 completa), quantos registraram algo
   (`expense_created` manual ou `no_spend_checkin`) entre o dia 7 e o dia 13 após o
   onboarding.
3. **Lançamentos via notificação** — `expense_created` com `source = notification`
   ÷ `expense_created` manuais (`quick_entry` + `notification`). Ao lado:
   lembretes enviados na janela e a razão gastos via notificação ÷ lembretes enviados.
4. **Acerto da sugestão de balde** — entre `expense_created` manuais com
   `suggestedBucket` não nulo, % com `overridden = false`. Ao lado: % de gastos
   manuais sem sugestão (dicionário não reconheceu), que indica onde ampliar o
   dicionário.

Extras na mesma página: usuários ativos nos últimos 7 dias e total de usuários com
lembrete ativo.

- Agregações em SQL (`prisma.$queryRaw` com `Prisma.sql`, parâmetros tipados) em
  `server/metrics.ts`; formatação (`formatRatio(num, den)`) em função pura em
  `lib/domain/metrics.ts`. Denominador zero exibe "—".
- **Exclusão dos admins:** as métricas ignoram os ids de `ADMIN_USER_IDS` por
  padrão, com toggle "Incluir meus dados".

## Data Model

```prisma
model Event {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id")
  name      String
  props     Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([name, createdAt])
  @@index([userId, createdAt])
  @@map("events")
}
```

## Estrutura de arquivos (novos)

```
app/(app)/admin/page.tsx       # métricas, restrita a ADMIN_USER_IDS
lib/analytics/events.ts        # EventMap e nomes válidos
lib/domain/metrics.ts          # formatRatio(), isAdmin()
server/analytics.ts            # trackEvent()
server/metrics.ts              # agregações SQL
```

## Risks / Trade-offs
- **Poucos usuários, números instáveis** → numerador/denominador sempre visíveis;
  decisões só com tendência de 2+ semanas.
- **`after()` perde o evento se a função serverless morrer antes** → aceitável para
  métricas; não é dado de negócio.
- **`src=notification` falsificável** → só afeta métricas do próprio usuário.
- **Métrica de acerto depende de o cliente enviar `suggestedBucket`** → o servidor
  recalcula `suggestBucket(description)` na Server Action em vez de confiar no
  cliente; `overridden = suggested !== null && suggested !== bucket`.

## Migration Plan
1. `prisma migrate dev --create-only --name usage_events` → revisar → aplicar na `dev`
2. Configurar `ADMIN_USER_IDS` na Vercel (Production e Preview) e no `.env.local`
3. Deploy; métricas começam a contar a partir do deploy

## Open Questions
- Backfill de `onboarding_completed` a partir de `user_settings.onboarded_at` para
  não perder os usuários atuais na métrica 1? (Proposta: sim, no SQL da migration.)

# Design

## Context
MVP de um app de finanças pessoais baseado no método 50/30/20, voltado para
pessoas que ainda não fazem nenhum controle financeiro. O foco é reduzir ao
máximo o atrito de registro: renda no onboarding, lançamento em poucos toques
e um painel que responde "quanto ainda posso gastar em cada balde?".

Repositório já criado em Next.js; banco Postgres já provisionado no Neon;
Prisma ORM instalado (sem schema ainda).

## Goals / Non-Goals

**Goals**
- Onboarding em 1 passo (renda mensal → baldes calculados)
- Lançamento de gasto em ≤ 3 interações, com sugestão automática de balde
- Painel mensal com saldo por balde e alerta de estouro
- PWA instalável, mobile-first

**Non-Goals**
- Open Finance / importação de extrato
- Contas compartilhadas (casal/família)
- Percentuais customizados (fixo em 50/30/20 no MVP)
- Classificação por IA (v2)

## Decisions

### D1 — PWA com Next.js App Router
- Server Components para leitura (painel), Server Actions para escrita
  (onboarding, lançamento). Sem API REST separada no MVP.
- Service worker e manifest via **Serwist** (`@serwist/next`).
- **Alternativa descartada:** React Native/Expo — mais setup, publicação em loja,
  validação mais lenta.

### D2 — Neon + Prisma ORM
- Schema em `prisma/schema.prisma`, migrations com `prisma migrate dev` (dev)
  e `prisma migrate deploy` (CI/produção).
- Client gerado com o generator `prisma-client` em `src/generated/prisma`
  (adicionar ao `.gitignore`; rodar `prisma generate` no `postinstall`).
- Runtime com **driver adapter** `@prisma/adapter-neon` usando a connection
  string **pooled** (`DATABASE_URL`).
- CLI (migrations) via `prisma.config.ts` usando a connection string **direct**
  (`DIRECT_URL`, host sem `-pooler`).
- Tabelas e colunas em snake_case no banco via `@@map` / `@map`; models e
  campos em PascalCase/camelCase no código.
- Singleton do client em `src/lib/prisma.ts` (evita múltiplas instâncias no
  hot reload do `next dev`).
- **Alternativa considerada:** Drizzle — SQL tipado e mais leve, mas o Prisma já
  está instalado e atende o MVP; DX do schema e Prisma Studio pesaram a favor.

```ts
// prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DIRECT_URL') },
});
```

```ts
// src/lib/prisma.ts
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const createClient = () =>
  new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }),
  });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

> Se o projeto estiver no Prisma 6, a URL fica no `datasource` do schema
> (`url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")`) e o generator
> pode continuar `prisma-client-js`.

### D3 — Dinheiro em centavos (inteiro)
- Todos os valores em `Int` (centavos). Nunca `Float`/`Decimal` para cálculo no MVP.
- Formatação só na borda (UI) com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Divisão dos baldes: `needs = floor(income * 0.5)`, `wants = floor(income * 0.3)`,
  `savings = income - needs - wants` (o resto absorve o arredondamento, a soma
  sempre bate com a renda).

### D4 — Ciclo mensal como entidade
- Cada mês é um `BudgetCycle` com a renda daquele mês "congelada".
  Mudar a renda não altera meses passados.
- Ciclo criado sob demanda: ao acessar o painel num mês sem ciclo, cria-se um
  novo copiando a última renda informada.
- Mês identificado por `period` no formato `YYYY-MM`, com timezone do usuário
  (default `America/Sao_Paulo`).
- Unicidade por `@@unique([userId, period], name: "userId_period")`.

### D5 — Saldo calculado, não armazenado
- Saldo do balde = limite do ciclo − soma dos gastos do balde:
  ```ts
  prisma.expense.groupBy({
    by: ['bucket'],
    where: { cycleId, userId },
    _sum: { amountCents: true },
  });
  ```
- Sem colunas de saldo desnormalizadas no MVP (evita inconsistência).
  Reavaliar com índice/materialização se o volume crescer.

### D6 — Sugestão de balde por palavras-chave
- Função pura `suggestBucket(description): Bucket | null` em `lib/domain/`,
  baseada num dicionário em código (ex.: `mercado`, `aluguel`, `luz` → needs;
  `ifood`, `cinema`, `bar` → wants; `tesouro`, `cdb`, `reserva` → savings).
- Parser de entrada rápida: `"mercado 120"` / `"120 mercado"` / `"uber 23,50"`
  → `{ description, amountCents }`. Aceita vírgula ou ponto decimal.
- Fallback quando não há match: `needs` pré-selecionado, usuário troca com 1 toque.
- Domínio 100% em TS puro e testável (Vitest). O tipo `Bucket` do domínio é um
  union literal próprio (`'needs' | 'wants' | 'savings'`), compatível com o enum
  gerado pelo Prisma, mas sem importar o client — mantém o domínio desacoplado do ORM.

### D7 — Autenticação
- **Better Auth** com `prismaAdapter(prisma, { provider: 'postgresql' })`,
  login por e-mail (magic link) + Google.
- Models de auth (`User`, `Session`, `Account`, `Verification`) no mesmo
  `schema.prisma`; conferir com `npx @better-auth/cli generate`.
- **Alternativa:** Neon Auth, se preferir manter auth gerenciado no Neon.
- Toda query filtra por `userId` da sessão na camada de dados
  (`src/server/queries.ts`); nenhuma Server Action recebe `userId` do cliente.

### D8 — Datas de gasto
- `occurredOn` é `@db.Date`. O Prisma devolve `Date` em UTC; gravar sempre a data
  local do usuário como `YYYY-MM-DDT00:00:00.000Z` e nunca converter com timezone
  na leitura (tratar como data "pura").

## Data Model

Ver `prisma/schema.prisma`. Resumo:

| Model          | Tabela           | Pontos-chave                                              |
|----------------|------------------|-----------------------------------------------------------|
| `UserSettings` | `user_settings`  | PK = `userId`; `defaultIncomeCents`, `onboardedAt`, `timezone` |
| `BudgetCycle`  | `budget_cycles`  | unique `(userId, period)`; limites dos 3 baldes em centavos |
| `Expense`      | `expenses`       | `amountCents`, `bucket` (enum), `occurredOn` (date); índices `(cycleId, bucket)` e `(userId, occurredOn)` |
| `User` etc.    | `user`, `session`, `account`, `verification` | Better Auth                       |

CHECK constraints (o Prisma não declara no schema — adicionar no SQL da migration
gerada com `--create-only`):
```sql
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_positive" CHECK ("amount_cents" > 0);
ALTER TABLE "budget_cycles" ADD CONSTRAINT "budget_cycles_income_positive" CHECK ("income_cents" > 0);
```

## Estrutura de pastas

```
prisma/
  schema.prisma
  migrations/
prisma.config.ts
src/
  app/
    (auth)/login/page.tsx
    onboarding/page.tsx          # renda mensal
    (app)/page.tsx               # painel do mês
    (app)/novo/page.tsx          # lançamento rápido
    api/auth/[...all]/route.ts   # Better Auth
    manifest.ts
    sw.ts                        # Serwist
  generated/prisma/              # client gerado (gitignored)
  lib/
    prisma.ts                    # singleton + adapter Neon
    auth.ts                      # Better Auth + prismaAdapter
    money.ts                     # formatBRL(), parseBRL()
    domain/
      buckets.ts                 # splitIncome(), BUCKET_RATIOS, type Bucket
      suggest-bucket.ts          # dicionário + suggestBucket()
      parse-quick-entry.ts       # "mercado 120" -> { description, amountCents }
      period.ts                  # currentPeriod(tz)
  server/
    queries.ts                   # sempre escopado por userId
  actions/
    onboarding.ts                # completeOnboarding(incomeCents)
    expenses.ts                  # createExpense(), deleteExpense()
```

## Risks / Trade-offs
- **Iniciante abandona no 3º dia** → lembrete diário via Web Push (fase 2 do MVP);
  no iOS só funciona com o PWA instalado, então o onboarding deve incentivar
  "Adicionar à tela inicial".
- **Classificação errada irrita** → sempre mostrar o balde sugerido antes de salvar,
  trocar com 1 toque; registrar correções para alimentar a v2.
- **Renda variável (freela/autônomo)** → MVP assume renda fixa mensal; editar a
  renda do ciclo atual recalcula os limites daquele mês.
- **Concorrência na criação do ciclo** → `prisma.budgetCycle.upsert` com
  `where: { userId_period: { userId, period } }` pode lançar `P2002` em requisições
  simultâneas; capturar o erro e refazer `findUniqueOrThrow` (helper `getOrCreateCycle`).
- **Atomicidade no onboarding** (settings + ciclo) → usar
  `prisma.$transaction([...])` (batch), suportado pelo adapter Neon.
- **`prisma generate` esquecido no deploy** → script `postinstall: prisma generate`
  no `package.json`.

## Migration Plan
1. `npx prisma migrate dev --create-only --name init` → revisar SQL → adicionar CHECK constraints
2. `npx prisma migrate dev` aplicando na branch `dev` do Neon
3. Produção: `npx prisma migrate deploy` com `DIRECT_URL` da branch `main`

## Open Questions
- Better Auth ou Neon Auth? Resposta: Better Auth.
- Lançamento retroativo (dias anteriores) entra no MVP ou só o dia atual? Resposta: Teremos sim, entra no MVP.
- Mostrar "dias restantes no mês × quanto posso gastar por dia" no painel? (forte para iniciante) Reposta: Sim, vamos adicionar.

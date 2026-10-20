## 1. Setup do projeto
- [x] 1.1 Instalar dependências: `@prisma/client`, `@prisma/adapter-neon`, `dotenv`, `better-auth`, `zod`, `@serwist/next`, `serwist` (dev: `prisma`)
  - `@prisma/client`, `@prisma/adapter-neon`, `dotenv`, `prisma` já estavam instalados (change anterior). Instalei `zod`, `serwist`, `@serwist/next`. **Não instalei `better-auth`**: a seção "Open Questions" do próprio design.md já resolveu "Better Auth ou Neon Auth?" a favor do Neon Auth, que já está instalado e funcionando (`@neondatabase/auth`, `lib/auth/*`, `/api/auth`, `/api/me` — de outra sessão). `better-auth` já existe de qualquer forma como dependência transitiva do Neon Auth.
- [x] 1.2 Instalar e configurar Tailwind + shadcn/ui (componentes: button, input, card, sheet, toggle-group, sonner)
  - Tailwind v4 já estava instalado. `shadcn init` + os 6 componentes pedidos. O init sobrescreveu `--font-sans: var(--font-sans)` (circular) em `app/globals.css`; corrigi para `var(--font-geist-sans)`. Também trocou o dark mode de `@media (prefers-color-scheme: dark)` pra uma classe `.dark` — dark mode automático por OS para de funcionar até alguém ligar `next-themes` ou similar; não é escopo das seções 1-3, só registrando.
- [x] 1.3 Configurar Vitest para testes de domínio (`lib/domain/**`)
  - Já satisfeito: `vitest.config.ts` (da change anterior) já tem `include: ["**/*.test.ts"]`, cobrindo `lib/domain/**` e `lib/*.test.ts` sem mudança.
- [x] 1.4 Configurar variáveis de ambiente: `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `DATABASE_URL`/`DATABASE_URL_UNPOOLED` (com `DIRECT_URL` como fallback aceito, ver `prisma.config.ts`) já configuradas em `.env.local`. **Não adicionei** `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — mesma razão da 1.1 (Neon Auth substitui essa necessidade; essas variáveis não têm consumidor no código).
- [x] 1.5 Criar `.env.example` com todas as variáveis (sem valores)
  - Já existia (change anterior) documentando `DATABASE_URL`/`DATABASE_URL_UNPOOLED`/Neon Auth. Nenhuma variável nova introduzida pelas seções 1-3 precisa ser adicionada (ver nota da 1.4).
- [x] 1.6 Validar env no boot com zod (`src/env.ts`)
  - Criado em `lib/env.ts` (raiz, não `src/` — ver decisão de estrutura abaixo) + `instrumentation.ts` chamando-o no `register()`. Valida só `DATABASE_URL` (a única variável que o app em si precisa pra rodar; `DIRECT_URL`/`DATABASE_URL_UNPOOLED` é só do Prisma CLI, já validada separadamente em `prisma.config.ts`). Confirmei empiricamente que `register()` NÃO roda durante `next build` (build passa sem `.env.local`), e que roda e falha com erro claro no boot do `next dev`/`next start` sem `DATABASE_URL`.

## 2. Banco de dados (Neon + Prisma)

> **Decisão de estrutura (confirmada com o usuário antes de começar):** o `design.md` assume tudo sob `src/`, mas o projeto atual (da change `bootstrap-mobile-first-nextjs-app`, já arquivada) vive na raiz (`app/`, `components/`, `lib/`, alias `@/* → ./*`). Optamos por manter a raiz em vez de migrar o projeto inteiro para `src/`. Os itens abaixo usam `lib/...` em vez de `src/lib/...`.

- [x] 2.1 Criar `prisma/schema.prisma` conforme design.md (generator `prisma-client` com output em `src/generated/prisma`)
  - O arquivo já existia (editado antes desta sessão) com todo o domínio 50/30/20 + tabelas do Better Auth/Neon Auth, exatamente como o design.md descreve — só corrigi `output` de `../src/generated/prisma` para `../lib/generated/prisma` (decisão de estrutura acima) e removi o diretório `src/` órfão que tinha sido gerado lá.
- [x] 2.2 Criar `prisma.config.ts` com `datasource.url = env('DIRECT_URL')`
  - Já existia (change anterior) e **deliberadamente não usa** o helper `env()`: ele lança erro já no carregamento da config para comandos que não precisam da URL (`prisma generate`, chamado no `postinstall` de todo `pnpm install`), o que quebraria `pnpm install` num clone novo sem `.env` — bug real que eu mesmo reproduzi e corrigi na change anterior. Usa `process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DIRECT_URL"]` (suporta os dois nomes); comandos que de fato precisam da URL ainda falham com erro claro.
- [x] 2.3 Criar `src/lib/prisma.ts`: singleton do `PrismaClient` com `PrismaNeon({ connectionString: DATABASE_URL })`
  - Já satisfeito por `lib/db.ts` (change anterior): singleton em `globalThis`, `PrismaNeon` + `DATABASE_URL`, exposto como `Proxy` preguiçoso (não instancia no escopo do módulo, pelo mesmo motivo do `prisma.config.ts` — evaita quebrar `next build` sem banco configurado). Não criei um arquivo novo para não duplicar o singleton.
- [x] 2.4 Adicionar `src/generated/prisma` ao `.gitignore` e `"postinstall": "prisma generate"` no `package.json`
  - Já satisfeito: `.gitignore` já ignora `/lib/generated/` (decisão de estrutura) e `postinstall`/`prebuild` já rodam `prisma generate` (change anterior).
- [x] 2.5 Gerar migration inicial com `prisma migrate dev --create-only --name init` e adicionar CHECK constraints (`amount_cents > 0`, `income_cents > 0`) no SQL
  - Migration `20261020150521_init` gerada com `--create-only`, SQL mostrado ao usuário, CHECK constraints adicionadas manualmente. (Já existia uma migration `..._init` vazia da change anterior; o Prisma não tem problema com o nome "init" repetido.)
- [x] 2.6 Aplicar migration na branch `dev` do Neon (`prisma migrate dev`) e conferir no Prisma Studio
  - Aplicada com `pnpm db:migrate` (confirmação do usuário antes de aplicar). `prisma migrate status` reporta "Database schema is up to date!". Em vez de abrir o Prisma Studio (UI interativa, não roda num script), confirmei via uma rota de API temporária (removida depois) que ambas as CHECK constraints existem de fato no banco (`pg_constraint`).

## 3. Domínio (TS puro, com testes)
- [x] 3.1 `lib/money.ts`: `parseBRL(input): number | null` (aceita "5000", "5.000", "5000,50", "5.000,50") e `formatBRL(cents)`
- [x] 3.2 Testes de `parseBRL`: formatos válidos, vazio, zero, negativo, lixo ("abc")
- [x] 3.3 `lib/domain/buckets.ts`: `splitIncome(incomeCents)` com floor em needs/wants e resto em savings
  - Usa `BigInt` (via `BigInt(50)`/`BigInt(100)`, não o literal `50n` — o `tsconfig.json` do projeto tem `target: "ES2017"`, que não suporta literais BigInt) em vez de `Math.floor(income * 0.5)`: multiplicação/divisão em ponto flutuante podia arredondar um centavo errado para certos valores de renda.
- [x] 3.4 Testes de `splitIncome`: R$ 5.000,00 → 250000/150000/100000; R$ 1.234,57 → soma igual à renda
- [x] 3.5 `lib/domain/period.ts`: `currentPeriod(tz)` → `YYYY-MM`
- [x] 3.6 Testes de `currentPeriod`: virada de mês em `America/Sao_Paulo` vs UTC
- [x] 3.7 `lib/domain/parse-quick-entry.ts`: "mercado 120", "120 mercado", "uber 23,50" → `{ description, amountCents }`
  - Usa um parser de valor próprio (não `parseBRL` de `lib/money.ts`): `parseBRL` trata "." como separador de milhar (correto pra valores formatados), o que interpretaria "23.50" como R$ 2.350,00 em vez de R$ 23,50. Em lançamento rápido, "," e "." são ambos separador decimal.
- [x] 3.8 Testes de `parseQuickEntry`: valor antes/depois, decimal com vírgula/ponto, sem valor, sem descrição
- [x] 3.9 `lib/domain/suggest-bucket.ts`: dicionário de palavras-chave + `suggestBucket(description)` (case/acento-insensitive)
- [x] 3.10 Testes de `suggestBucket`: match por bucket, sem match → `null`, acentos ("açougue")

## 4. Autenticação
- [ ] 4.1 Configurar Better Auth em `src/lib/auth.ts` com `prismaAdapter(prisma, { provider: 'postgresql' })`; conferir models de auth com `npx @better-auth/cli generate` e migrar
- [ ] 4.2 Habilitar login com Google e magic link por e-mail
- [ ] 4.3 Criar `src/app/api/auth/[...all]/route.ts`
- [ ] 4.4 Criar helper `getSessionUserOrRedirect()` para Server Components e Server Actions
- [ ] 4.5 Tela `/(auth)/login` mobile-first

## 5. Camada de dados
- [ ] 5.1 `src/server/queries.ts`: todas as funções recebem `userId` da sessão, nunca do cliente
- [ ] 5.2 `getUserSettings(userId)`, `upsertUserSettings(...)`
- [ ] 5.3 `getOrCreateCycle(userId, period)` idempotente via `prisma.budgetCycle.upsert` em `userId_period`, capturando `P2002` e refazendo `findUniqueOrThrow`
- [ ] 5.4 `getCycleBalances(userId, cycleId)`: limites − `prisma.expense.groupBy({ by: ['bucket'], _sum: { amountCents: true } })`
- [ ] 5.5 `createExpense(...)`, `deleteExpense(userId, expenseId)`, `listExpenses(cycleId)`

## 6. Onboarding (spec: onboarding)
- [ ] 6.1 Guarda de rota: sem `onboarded_at` → `/onboarding`; com `onboarded_at` em `/onboarding` → painel (layout de `(app)` e page de onboarding)
- [ ] 6.2 Tela `/onboarding`: campo de renda com máscara pt-BR e validação ("Informe quanto você recebe por mês")
- [ ] 6.3 Prévia ao vivo da divisão 50/30/20 com frase de exemplo por balde
- [ ] 6.4 Server Action `completeOnboarding(incomeCents)`: valida com zod, grava settings e cria ciclo do mês em `prisma.$transaction`, redireciona
- [ ] 6.5 Garantir idempotência (duplo clique / retry não duplica ciclo)
- [ ] 6.6 Sugestão de instalação do PWA ao concluir, com "Agora não"

## 7. Lançamento rápido (spec: expense-entry)
- [ ] 7.1 Tela/sheet `/(app)/novo`: input único com autofoco ("mercado 120")
- [ ] 7.2 Parse em tempo real com `parseQuickEntry` + balde sugerido via `suggestBucket` (fallback: needs)
- [ ] 7.3 Toggle de balde trocável com 1 toque
- [ ] 7.4 Server Action `createExpense`: valida (valor > 0, descrição não vazia), associa ao ciclo do mês atual
- [ ] 7.5 Mensagem de erro para valor vazio/negativo; toast de sucesso com "Desfazer"
- [ ] 7.6 Garantir fluxo em ≤ 3 interações (digitar → confirmar balde → salvar)

## 8. Painel (spec: budget-dashboard)
- [ ] 8.1 Página `/(app)`: cards de Necessidades, Lazer e Investimentos com limite, gasto e disponível
- [ ] 8.2 Estado de alerta quando balde estoura, exibindo valor excedido
- [ ] 8.3 Estado vazio (mês sem gastos): limites cheios + atalho para o primeiro lançamento
- [ ] 8.4 Lista dos últimos gastos do mês com opção de excluir
- [ ] 8.5 Botão flutuante de "novo gasto" sempre visível
- [ ] 8.6 Criação automática do ciclo ao acessar mês sem ciclo (copia `default_income_cents`)

## 9. PWA
- [ ] 9.1 `src/app/manifest.ts` (nome, ícones 192/512, `display: standalone`, theme color)
- [ ] 9.2 Service worker com Serwist (`src/app/sw.ts`) e registro no `next.config`
- [ ] 9.3 Testar instalação no Android (Chrome) e iOS (Safari → Adicionar à Tela de Início)

## 10. Validação final
- [ ] 10.1 Rodar `vitest` com todos os testes de domínio passando
- [ ] 10.2 Testar manualmente todos os cenários das 3 specs
- [ ] 10.3 Validar isolamento: usuário A não acessa ciclo/gasto do usuário B
- [ ] 10.4 Deploy na Vercel com envs de produção e `prisma migrate deploy` na branch `main` do Neon
- [ ] 10.5 `openspec validate add-mvp-503020 --strict`

## 1. Setup do projeto
- [ ] 1.1 Instalar dependências: `@prisma/client`, `@prisma/adapter-neon`, `dotenv`, `better-auth`, `zod`, `@serwist/next`, `serwist` (dev: `prisma`)
- [ ] 1.2 Instalar e configurar Tailwind + shadcn/ui (componentes: button, input, card, sheet, toggle-group, sonner)
- [ ] 1.3 Configurar Vitest para testes de domínio (`lib/domain/**`)
- [ ] 1.4 Configurar variáveis de ambiente: `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] 1.5 Criar `.env.example` com todas as variáveis (sem valores)
- [ ] 1.6 Validar env no boot com zod (`src/env.ts`)

## 2. Banco de dados (Neon + Prisma)
- [ ] 2.1 Criar `prisma/schema.prisma` conforme design.md (generator `prisma-client` com output em `src/generated/prisma`)
- [ ] 2.2 Criar `prisma.config.ts` com `datasource.url = env('DIRECT_URL')`
- [ ] 2.3 Criar `src/lib/prisma.ts`: singleton do `PrismaClient` com `PrismaNeon({ connectionString: DATABASE_URL })`
- [ ] 2.4 Adicionar `src/generated/prisma` ao `.gitignore` e `"postinstall": "prisma generate"` no `package.json`
- [ ] 2.5 Gerar migration inicial com `prisma migrate dev --create-only --name init` e adicionar CHECK constraints (`amount_cents > 0`, `income_cents > 0`) no SQL
- [ ] 2.6 Aplicar migration na branch `dev` do Neon (`prisma migrate dev`) e conferir no Prisma Studio

## 3. Domínio (TS puro, com testes)
- [ ] 3.1 `lib/money.ts`: `parseBRL(input): number | null` (aceita "5000", "5.000", "5000,50", "5.000,50") e `formatBRL(cents)`
- [ ] 3.2 Testes de `parseBRL`: formatos válidos, vazio, zero, negativo, lixo ("abc")
- [ ] 3.3 `lib/domain/buckets.ts`: `splitIncome(incomeCents)` com floor em needs/wants e resto em savings
- [ ] 3.4 Testes de `splitIncome`: R$ 5.000,00 → 250000/150000/100000; R$ 1.234,57 → soma igual à renda
- [ ] 3.5 `lib/domain/period.ts`: `currentPeriod(tz)` → `YYYY-MM`
- [ ] 3.6 Testes de `currentPeriod`: virada de mês em `America/Sao_Paulo` vs UTC
- [ ] 3.7 `lib/domain/parse-quick-entry.ts`: "mercado 120", "120 mercado", "uber 23,50" → `{ description, amountCents }`
- [ ] 3.8 Testes de `parseQuickEntry`: valor antes/depois, decimal com vírgula/ponto, sem valor, sem descrição
- [ ] 3.9 `lib/domain/suggest-bucket.ts`: dicionário de palavras-chave + `suggestBucket(description)` (case/acento-insensitive)
- [ ] 3.10 Testes de `suggestBucket`: match por bucket, sem match → `null`, acentos ("açougue")

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

# Pave

Aplicação Next.js (App Router, TypeScript) **mobile first**, com Prisma ORM
conectado a um banco PostgreSQL gerenciado pelo [NeonDB](https://neon.tech).

## Pré-requisitos

- Node.js 24+ e [pnpm](https://pnpm.io) (`corepack enable` já resolve isso via `package.json#packageManager`).
- Um projeto no [Neon](https://console.neon.tech) (camada gratuita é suficiente).

## Configurando o Neon

1. Crie um projeto no [console do Neon](https://console.neon.tech).
2. Na aba **Connection Details** do seu branch/database, copie duas connection
   strings:
   - **Pooled connection** (host termina em `-pooler`) → vai em `DATABASE_URL`.
   - **Direct connection** (sem `-pooler`) → vai em `DIRECT_URL`.
3. Copie `.env.example` para `.env` e cole os dois valores.

`DATABASE_URL` é usada pela aplicação em runtime (via
`@prisma/adapter-neon`, o driver serverless do Neon). `DIRECT_URL` é usada
só pelo Prisma CLI (migrations, Studio) — migrations não são seguras via
PgBouncer, por isso precisam da conexão direta.

## Instalação

```bash
pnpm install       # roda `prisma generate` automaticamente (postinstall)
pnpm db:migrate    # aplica as migrations no banco configurado em DIRECT_URL
pnpm dev           # http://localhost:3000
```

Verifique a conexão com o banco em
[http://localhost:3000/api/health](http://localhost:3000/api/health) — deve
responder `200 {"status":"ok","database":"up"}`.

## Scripts

| Script              | O que faz                                              |
| -------------------- | ------------------------------------------------------- |
| `pnpm dev`           | Sobe o servidor de desenvolvimento (Turbopack).          |
| `pnpm build`         | Build de produção (`prebuild` roda `prisma generate`).  |
| `pnpm start`         | Serve o build de produção.                              |
| `pnpm lint`          | ESLint.                                                  |
| `pnpm test`          | Testes unitários (Vitest).                               |
| `pnpm db:generate`   | Gera o Prisma Client em `lib/generated/prisma`.          |
| `pnpm db:migrate`    | Cria/aplica migrations em desenvolvimento.               |
| `pnpm db:deploy`     | Aplica migrations existentes (uso em produção/CI).       |
| `pnpm db:studio`     | Abre o Prisma Studio.                                    |

## Convenções mobile first

- **Estilos base sem prefixo** valem para a menor largura suportada (360px);
  adaptações para telas maiores usam os breakpoints `sm:`/`md:`/`lg:` do
  Tailwind, que são todos `min-width` — nunca escreva CSS "desktop first"
  com `max-width`.
- **Alvos de toque** (links, botões) devem ter no mínimo 44×44px
  (`min-h-11 min-w-11` no Tailwind, que usa `rem` = 44px na escala padrão).
- **Áreas seguras**: qualquer elemento fixo nas bordas da tela (header,
  navegação inferior) usa os utilitários `.pt-safe`/`.pb-safe`/`.pl-safe`/`.pr-safe`
  definidos em `app/globals.css`, que envolvem `env(safe-area-inset-*)`.
- **Sem rolagem horizontal**: evite larguras fixas em `px` maiores que a
  menor tela suportada; prefira `flex`, `grid` e `max-w-*`.
- O shell da aplicação (`components/shell/AppHeader.tsx` e
  `components/shell/BottomNav.tsx`, montados em `app/layout.tsx`) já
  implementa essas convenções — novas telas devem reaproveisá-lo em vez de
  criar layouts próprios.

## Estrutura

```
app/                 rotas (App Router), layout raiz, manifest, health check
  api/health/         GET /api/health
components/shell/     AppHeader, BottomNav
lib/db.ts             cliente Prisma (singleton, lazy)
prisma/schema.prisma  schema do banco
prisma.config.ts      config do Prisma CLI (usa DIRECT_URL)
```

## Testes

- `pnpm test` — testes unitários (Vitest): `/api/health` (sucesso, falha,
  timeout) e `lib/db.ts` (erro claro quando `DATABASE_URL` falta, cliente
  reutilizado entre reloads).
- Testes end-to-end (Playwright) cobrindo o shell mobile (rolagem
  horizontal, alvos de toque, navegação, manifest) ainda não estão
  configurados neste ambiente de desenvolvimento — o Chromium do Playwright
  não conseguiu iniciar aqui (ver nota abaixo). Configure-os em um ambiente
  onde o Chromium headless funcione (CI, outra máquina) antes de depender
  deles.
- Auditoria Lighthouse (mobile, Performance/Accessibility ≥ 90) também
  depende de um Chrome/Chromium funcional — mesma limitação.

> **Nota de ambiente**: em algumas instalações do WSL2, o Chromium baixado
> pelo Playwright encerra com `SIGSEGV` mesmo com `--version`, mesmo com
> todas as dependências de sistema presentes (`playwright install-deps`
> reporta tudo instalado). Se você vir esse mesmo problema, tente rodar os
> testes e2e/Lighthouse fora do WSL2 (Windows nativo, Linux real ou CI).

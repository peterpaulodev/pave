## Context

Projeto greenfield: `/home/peter/Repos/pave` só contém `.claude/` e `openspec/`, e ainda não é um repositório git. Ambiente local observado: Node 24.19, npm 11.17, pnpm 10.22. Versões atuais no npm (set/2026): `next` 16.3.x, `tailwindcss` 4.3.x, `@prisma/client` e `@prisma/adapter-neon` 7.10.0. A dist-tag `latest` do pacote `prisma` aponta para `8.0.0-rc.15` (release candidate), enquanto `@prisma/client` segue em 7.10.0.

Motivação em `proposal.md`; requisitos em `specs/mobile-app-shell/spec.md` e `specs/database-connection/spec.md`.

## Goals / Non-Goals

**Goals:**
- Esqueleto pronto para receber features: `pnpm dev` sobe o app, `pnpm db:migrate` aplica o schema no Neon, `/api/health` confirma a conexão.
- Convenções mobile first codificadas em tokens e componentes do shell, para que novas telas sigam o padrão sem retrabalho.
- Testes automatizados cobrindo os cenários das specs que dá para verificar em CI (health check, layout em viewports móveis).

**Non-Goals:**
- Design visual final (cores e tipografia são provisórias).
- Service worker, cache offline, push notifications.
- Modelos de domínio: o schema Prisma começa sem models de produto.

## Decisions

### 1. Next.js App Router + TypeScript, na raiz do repositório
Um único app na raiz, sem monorepo. O `create-next-app` recusa diretórios com arquivos conflitantes, então o scaffold é gerado em um diretório temporário e os arquivos são movidos para a raiz, preservando `.claude/` e `openspec/`.
- *Alternativa*: monorepo (Turborepo) com `apps/web`. Rejeitado: sem segundo pacote à vista, só adiciona complexidade.

### 2. pnpm como gerenciador de pacotes
Já instalado, instala mais rápido e tem lockfile determinístico. Scripts documentados no README.
- *Alternativa*: npm. Funciona, mas não traz vantagem aqui.

### 3. Tailwind CSS v4 com mobile first nativo
As classes sem prefixo valem para todas as larguras e `sm:`/`md:`/`lg:` são `min-width`, ou seja, exatamente o modelo mobile first. Tokens (cores, altura do header/nav, raio, espaçamento) ficam em `@theme` no `app/globals.css`. Utilitários de safe area usam `env(safe-area-inset-*)`.
- *Alternativa*: CSS Modules. Mais verboso para responsividade e sem convenção imposta de breakpoints.

### 4. Estrutura do shell
- `app/layout.tsx`: exporta `viewport` (`width=device-width`, `initialScale: 1`, `viewportFit: "cover"`, `themeColor`) e `metadata` (manifest, apple-touch-icon, `appleWebApp`). Sem `maximumScale`/`userScalable: false`.
- `components/shell/AppHeader.tsx` (sticky, `padding-top: env(safe-area-inset-top)`).
- `components/shell/BottomNav.tsx` (client component; usa `usePathname` para `aria-current="page"`; `fixed bottom-0` com `padding-bottom: env(safe-area-inset-bottom)`; itens `min-h-11 min-w-11`, ou seja, 44px).
- O `<main>` recebe `padding-bottom` igual a altura da nav + safe area, para o último item não ficar escondido.
- Em `lg:` (≥1024px), a navegação vira um trilho lateral (nav rail) e o conteúdo fica centralizado com `max-w-screen-md`.
- Destinos iniciais provisórios: **Início** (`/`), **Explorar** (`/explorar`), **Perfil** (`/perfil`), com páginas placeholder e ícones SVG inline (sem biblioteca de ícones).
- Fonte via `next/font` (self-hosted, sem layout shift). Uso de `min-h-dvh` em vez de `100vh`, para evitar o bug da barra de endereço em mobile.

### 5. Manifest e ícones
`app/manifest.ts` (rota de metadata do Next) gera `/manifest.webmanifest`. Ícones PNG 192/512 e 512 maskable em `public/icons/`, mais `app/apple-icon.png` (180px), todos gerados de um SVG placeholder com `sharp` via script one-off (não fica como dependência).
- *Alternativa*: `next-pwa`/Serwist. Rejeitado por ora: só servem para service worker, que está fora do escopo.

### 6. Prisma 7.x estável, não 8.0 RC
Fixar `prisma`, `@prisma/client` e `@prisma/adapter-neon` em `7.10.x`. A dist-tag `latest` do CLI aponta para um RC, então instalar sem versão traria um CLI 8 incompatível com o client 7.
- *Alternativa*: Prisma 8 RC. Rejeitado: não é estável.

### 7. Configuração Prisma 7 + Neon
- `prisma/schema.prisma`: `generator client { provider = "prisma-client", output = "../lib/generated/prisma" }` e `datasource db { provider = "postgresql" }` (sem `url` no schema, que é o formato do Prisma 7). Pasta gerada no `.gitignore`; `postinstall` roda `prisma generate`.
- `prisma.config.ts`: `import "dotenv/config"` (Prisma 7 não carrega `.env` sozinho) e `datasource.url = process.env["DIRECT_URL"]` — **não** o helper `env()` de `prisma/config`: ele lança erro já no carregamento da config se a variável não existir, e todo comando do CLI carrega esse arquivo, incluindo `prisma generate` (rodado no `postinstall`, sem precisar de conexão). Com `env()`, um clone novo sem `.env` quebraria `pnpm install` inteiro. O CLI (migrate) usa a conexão **direta**, porque migrations não funcionam bem via PgBouncer; comandos que realmente precisam da URL (`migrate`, `studio`, `db ...`) ainda falham com erro claro quando ela falta.
- Runtime: `lib/db.ts` cria `new PrismaClient({ adapter: new PrismaNeon({ connectionString: DATABASE_URL }) })` com a URL **pooled** (host `-pooler`). Singleton em `globalThis` (sobrevive ao hot reload do `next dev`, que reavalia o módulo). Exposto como um `Proxy` preguiçoso — não instanciado no escopo do módulo: o Next.js avalia o módulo de cada rota para coletar sua config de segmento (`dynamic`, `runtime`) já em `next build`, então uma instanciação ansiosa exigiria `DATABASE_URL` só para buildar o app. A instanciação real (e a validação de `DATABASE_URL`, lançando `Error("DATABASE_URL não definida...")`) só acontece no primeiro acesso de fato a uma propriedade do client. Importa `server-only` para impedir uso em client components.
- Variáveis: `DATABASE_URL` (pooled) e `DIRECT_URL` (direta) em `.env`; `.env.example` versionado.
- *Alternativa*: driver `pg` com `@prisma/adapter-pg`. Funciona em Node, mas o adapter Neon (HTTP/WebSocket) se comporta melhor em funções serverless e edge, com cold start menor.

### 8. Migration inicial
Sem models de domínio, a primeira migration é criada vazia (`prisma migrate dev --name init --create-only`) só para estabelecer a tabela `_prisma_migrations` e o fluxo. Scripts: `db:generate`, `db:migrate` (dev), `db:deploy` (`migrate deploy`), `db:studio`.

### 9. Health check
`app/api/health/route.ts` com `export const dynamic = "force-dynamic"` e `runtime = "nodejs"`; executa `SELECT 1` via `prisma.$queryRaw` com timeout de ~5s (`Promise.race`); responde com `Cache-Control: no-store`. Erros são logados no servidor (`console.error`) e nunca serializados na resposta.

### 10. Testes
- **Vitest**: unidade do handler de health (prisma mockado: sucesso → 200, rejeição/timeout → 503 sem detalhes) e do `lib/db.ts` (erro nomeando `DATABASE_URL`).
- **Playwright** (projetos com dispositivos `Pixel 7` e `iPhone 13`, mais um desktop 1280px): sem rolagem horizontal em 320/360/1280px, bounding box dos itens da nav ≥44px, `aria-current` após navegar, último elemento visível acima da nav, manifest com os campos exigidos, meta viewport sem `user-scalable=no`.
- **Lighthouse**: verificação manual ou por script (`npx lighthouse --preset=perf --form-factor=mobile`) contra `pnpm build && pnpm start`; não vai para CI nesta mudança.
- Safe area e instalação standalone precisam de verificação manual em aparelho real (checklist nas tasks).

## Risks / Trade-offs

- [`create-next-app` muda defaults entre versões (ex.: Turbopack, ESLint vs Biome)] → aceitar os defaults da versão instalada e registrar no README; a spec não depende disso.
- [Cold start do Neon (compute suspenso) pode estourar o timeout do health check] → timeout de 5s; o 503 é o comportamento correto e a próxima chamada acorda o compute.
- [Esgotar conexões com a URL errada em runtime] → `.env.example` explica pooled vs direta; `lib/db.ts` usa só `DATABASE_URL`, e o CLI usa só `DIRECT_URL`.
- [Emulação do Playwright não reproduz safe areas reais] → teste manual em iOS/Android documentado.
- [Client gerado fora do `node_modules` quebra o build se `generate` não rodar] → `postinstall` + `prebuild` executando `prisma generate`.
- [Diretório não é repositório git, então o `.gitignore` não protege nada ainda] → a task de setup inclui `git init` antes de criar `.env`.

## Migration Plan

Não há sistema existente. Sequência: scaffold → shell mobile → Prisma/Neon → health → testes. Rollback = descartar os arquivos gerados; nenhum dado de produção é afetado (a migration inicial é vazia).

## Open Questions

- Nome de exibição e cores da marca para o manifest (placeholders "Pave" e cor neutra até definir).
- Plataforma de deploy (Vercel é o caminho natural; não afeta esta mudança).

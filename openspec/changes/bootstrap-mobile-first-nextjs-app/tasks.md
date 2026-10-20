## 1. Scaffold do projeto

- [x] 1.1 Rodar `git init` na raiz e verificar que `git status` funciona (sem commit ainda)
- [x] 1.2 Gerar o app com `pnpm create next-app@latest` (TypeScript, App Router, Tailwind, ESLint, sem `src/`, alias `@/*`) em diretório temporário e mover os arquivos para a raiz sem sobrescrever `.claude/` nem `openspec/`; verificar que `pnpm install` e `pnpm dev` sobem a página padrão em `http://localhost:3000`
- [x] 1.3 Ajustar `.gitignore` para incluir `.env*` (exceto `.env.example`) e `lib/generated/`; verificar com `git check-ignore .env .env.local lib/generated/x` e que `.env.example` não é ignorado
- [x] 1.4 Remover o conteúdo demo do template (página, SVGs e estilos de exemplo) e verificar que `pnpm lint` e `pnpm build` passam

## 2. Fundação mobile first

- [x] 2.1 Em `app/layout.tsx`, exportar `viewport` (`width=device-width`, `initialScale: 1`, `viewportFit: "cover"`, `themeColor`) sem restringir zoom e `metadata` com `lang="pt-BR"`, `appleWebApp` e fonte via `next/font`; verificar no HTML renderizado a meta viewport com `viewport-fit=cover` e sem `user-scalable=no`
- [x] 2.2 Definir tokens em `app/globals.css` (`@theme`: cores provisórias, altura do header e da nav) e utilitários de safe area com `env(safe-area-inset-*)`, usando `min-h-dvh` no body; verificar que as classes são geradas no build
- [x] 2.3 Criar `components/shell/AppHeader.tsx` sticky com padding de safe area superior; verificar visualmente no DevTools (iPhone) que o header não sobrepõe o conteúdo
- [x] 2.4 Criar `components/shell/BottomNav.tsx` (client) com itens Início/Explorar/Perfil, ícones SVG inline, área de toque ≥44px, `aria-current="page"` via `usePathname`, foco visível e padding de safe area inferior; em `lg:` virar trilho lateral; verificar no DevTools em 360px e 1280px
- [x] 2.5 Montar o shell no layout (header + `<main>` com padding inferior igual à altura da nav + safe area + nav, conteúdo centralizado com `max-w-screen-md` em telas largas) e criar páginas placeholder `/`, `/explorar` e `/perfil`; verificar que navegar entre elas funciona e não há rolagem horizontal em 320px
- [x] 2.6 Gerar ícones placeholder (192, 512, 512 maskable em `public/icons/` e `app/apple-icon.png` 180px) a partir de um SVG com script one-off usando `sharp` via `pnpm dlx`; verificar dimensões dos arquivos com `file public/icons/*`
- [x] 2.7 Criar `app/manifest.ts` (nome "Pave", `short_name`, `start_url: "/"`, `display: "standalone"`, `theme_color`, `background_color`, ícones incluindo `purpose: "maskable"`); verificar `curl localhost:3000/manifest.webmanifest` e a aba Application do Chrome DevTools sem erros de instalabilidade

## 3. Prisma + NeonDB

- [x] 3.1 Instalar `prisma@7.10`, `@prisma/client@7.10`, `@prisma/adapter-neon@7.10`, `dotenv` e `server-only` com versões fixadas (não usar a dist-tag `latest` do CLI, que aponta para 8.0 RC); verificar com `pnpm prisma --version` que CLI e client estão em 7.10.x
- [x] 3.2 Criar `prisma/schema.prisma` (generator `prisma-client` com output `../lib/generated/prisma`, datasource `postgresql` sem url) e `prisma.config.ts` (`import "dotenv/config"`, `datasource.url = env("DIRECT_URL")`); adicionar scripts `postinstall`/`db:generate`/`db:migrate`/`db:deploy`/`db:studio` e `prisma generate` antes do build; verificar que `pnpm db:generate` gera o client em `lib/generated/prisma`
- [x] 3.3 Criar `.env.example` com `DATABASE_URL` (pooled, host `-pooler`) e `DIRECT_URL` (direta) com valores fictícios e comentários explicando o uso de cada uma; verificar que não há credenciais reais no arquivo
- [x] 3.4 Implementar `lib/db.ts` (`server-only`, valida `DATABASE_URL` com erro que nomeia a variável, `PrismaNeon` + `PrismaClient`, singleton em `globalThis` fora de produção); verificar com teste unitário (grupo 5) que a ausência da variável gera erro citando `DATABASE_URL`
- [ ] 3.5 Criar projeto/branch no Neon, preencher `.env` local com as duas URLs e criar a migration inicial vazia (`prisma migrate dev --name init --create-only`, depois `pnpm db:migrate`); verificar que `prisma/migrations/` foi versionada e que `pnpm prisma migrate status` reporta o banco atualizado
  - **BLOQUEADO**: sem projeto Neon disponível nesta sessão. Usuário optou por pular por enquanto (ver conversa). Retomar assim que houver `DATABASE_URL`/`DIRECT_URL` reais.

## 4. Health check

- [x] 4.1 Implementar `app/api/health/route.ts` (`dynamic = "force-dynamic"`, `runtime = "nodejs"`, `SELECT 1` com timeout de 5s, `Cache-Control: no-store`, 200 `{"status":"ok","database":"up"}` / 503 `{"status":"error","database":"down"}`, erro só no log do servidor); verificar com `curl -i localhost:3000/api/health` retornando 200 com o banco configurado
  - Implementado e com o caminho de sucesso coberto por teste unitário (task 5.2, mockando `$queryRaw`). O `curl` real contra um Neon configurado (200 com banco de verdade) fica pendente da task 3.5.
- [x] 4.2 Verificar a falha: com `DATABASE_URL` apontando para um host inválido, `curl -i /api/health` retorna 503 com o corpo exato, sem stack trace ou connection string

## 5. Testes automatizados

- [x] 5.1 Configurar Vitest (ambiente node, alias `@/`, script `test`) e verificar que `pnpm test` roda com um teste trivial
- [x] 5.2 Escrever testes unitários do health handler (prisma mockado: sucesso → 200 + corpo; rejeição e timeout → 503 + corpo sem detalhes; header `no-store`) e do `lib/db.ts` (erro nomeando `DATABASE_URL`); verificar que `pnpm test` passa
- [ ] 5.3 Configurar Playwright (projetos `Pixel 7`, `iPhone 13` e desktop 1280px; `webServer` com `pnpm build && pnpm start`; script `test:e2e`) e verificar que `pnpm test:e2e` executa
  - **BLOQUEADO**: o Chromium baixado pelo Playwright (`chromium-1243`) encerra com `SIGSEGV` neste WSL2 mesmo em `--version`, com todas as dependências de sistema presentes (`playwright install-deps --dry-run` confirma). Testado com `--no-sandbox`, `--single-process --no-zygote` e com o sandbox da própria ferramenta desligado — mesmo resultado. Provável incompatibilidade do binário Chrome-for-Testing com o kernel `6.18.33.2-microsoft-standard-WSL2`. Precisa rodar em outro ambiente (CI, Linux nativo, ou Windows nativo) para prosseguir.
- [ ] 5.4 Escrever testes e2e do shell: sem rolagem horizontal em 320/360/1280px (`scrollWidth <= clientWidth`), itens da nav com bounding box ≥44×44, `aria-current="page"` atualizado após tocar em outro item, último elemento de uma página longa visível acima da nav, meta viewport sem bloqueio de zoom, manifest com os campos e ícones exigidos; verificar que `pnpm test:e2e` passa em todos os projetos
  - **BLOQUEADO**: depende de 5.3. As verificações equivalentes foram feitas manualmente por inspeção de código + `curl` durante a implementação (ver histórico), mas isso não substitui os testes automatizados pedidos aqui.

## 6. Verificação final e documentação

- [ ] 6.1 Rodar Lighthouse mobile contra o build de produção da página inicial (`npx lighthouse http://localhost:3000 --form-factor=mobile --only-categories=performance,accessibility`) e verificar pontuação ≥90 nas duas categorias, corrigindo o que ficar abaixo
  - **BLOQUEADO**: Lighthouse usa o mesmo Chromium do Playwright para navegar; muito provavelmente atinge o mesmo `SIGSEGV` (ver 5.3). Não testado a fundo para não repetir o mesmo diagnóstico.
- [ ] 6.2 Validar em aparelho real (ou tunnel/rede local): em Android, instalar pela opção "Adicionar à tela inicial" e confirmar abertura em modo standalone; em iPhone com notch, confirmar header e nav fora das áreas seguras
  - **BLOQUEADO**: precisa de um aparelho físico do usuário.
- [x] 6.3 Escrever `README.md` (pré-requisitos, setup do Neon com pooled vs direta, variáveis, scripts, convenções mobile first: estilos base sem prefixo, breakpoints só `min-width`, alvos ≥44px, safe areas) e verificar que um clone limpo segue o README até `/api/health` retornar 200
  - README escrito e revisado contra o que foi de fato implementado. A verificação ponta a ponta "clone limpo → /api/health 200" depende de um Neon real (task 3.5).
- [x] 6.4 Rodar `pnpm lint && pnpm test && pnpm build` e confirmar que tudo passa

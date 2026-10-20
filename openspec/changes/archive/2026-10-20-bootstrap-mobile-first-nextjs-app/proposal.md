## Why

O repositório `pave` ainda não tem código: só a estrutura do OpenSpec. Antes de construir qualquer funcionalidade de produto, precisamos de uma base de aplicação que já nasça pensada para celular (layout, toque, viewport, instalação na tela inicial) e que se conecte a um banco PostgreSQL gerenciado (NeonDB) via Prisma. Assim, as próximas mudanças partem de uma fundação consistente em vez de adaptar um app desktop para mobile depois.

## What Changes

- Criar uma aplicação Next.js (App Router, TypeScript) na raiz do repositório.
- Estabelecer a abordagem **mobile first**: estilos base escritos para telas pequenas e ampliados por breakpoints `min-width`; viewport configurado corretamente; respeito às áreas seguras (notch / barra de gestos); alvos de toque de no mínimo 44×44px.
- Criar um shell de aplicação mobile: cabeçalho compacto, área de conteúdo rolável e navegação inferior (bottom navigation) fixa, com layout que se expande de forma adequada em telas maiores.
- Tornar o app instalável na tela inicial (Web App Manifest, ícones, `theme-color`, modo `standalone`). Service worker / suporte offline ficam fora do escopo.
- Configurar Prisma ORM (7.x estável) com PostgreSQL no NeonDB, usando o driver adapter serverless do Neon em runtime e conexão direta para migrations.
- Expor um endpoint de health check (`/api/health`) que confirma que a aplicação alcança o banco.
- Documentar variáveis de ambiente (`.env.example`) e scripts de desenvolvimento, build, lint e banco de dados.

**Fora do escopo**: autenticação, modelos de domínio do produto, suporte offline/service worker, app nativo (React Native/Capacitor), deploy/CI.

## Capabilities

### New Capabilities
- `mobile-app-shell`: fundação de UI mobile first: viewport, áreas seguras, alvos de toque, shell com navegação inferior, comportamento responsivo em telas maiores e instalabilidade via manifest.
- `database-connection`: conexão da aplicação ao PostgreSQL no NeonDB via Prisma, incluindo configuração por variáveis de ambiente, fluxo de migrations e health check do banco.

### Modified Capabilities
<!-- Nenhuma: não existem specs no projeto ainda. -->

## Impact

- **Código**: novo projeto Next.js na raiz (`app/`, `components/`, `lib/`, `prisma/`, `public/`), mais arquivos de configuração (`package.json`, `tsconfig.json`, `next.config.ts`, `prisma.config.ts`, config de ESLint/PostCSS).
- **Dependências**: `next`, `react`, `react-dom`, `tailwindcss` v4, `prisma`, `@prisma/client`, `@prisma/adapter-neon`, `dotenv`, TypeScript e ESLint.
- **Sistemas externos**: um projeto NeonDB com connection strings pooled e direta; credenciais ficam só em `.env` (não versionado).
- **APIs**: nova rota `GET /api/health`.

# Change: Métricas de uso

## Why
O app foi construído sobre hipóteses: que o lançamento rápido reduz atrito, que a
sugestão de balde acerta, que o lembrete traz o usuário de volta. Antes de investir
nas próximas features, precisamos saber onde está o atrito de verdade com usuários
reais. Hoje não existe nenhum registro de uso além dos próprios dados financeiros.

## What Changes
- Tabela de eventos de produto no próprio Postgres, sem ferramenta externa
- Registro dos eventos-chave: onboarding concluído, gasto criado (com origem e
  acerto da sugestão de balde), gasto excluído, conta fixa criada, lembrete
  ativado/desativado/enviado, dia sem gasto
- Registro de eventos nunca bloqueia nem quebra a ação do usuário
- Eventos não guardam descrição nem valor dos gastos
- Página `/admin` restrita a uma lista de usuários, com as métricas:
  conclusão do onboarding, retenção na semana 2, lançamentos vindos da
  notificação e taxa de acerto da sugestão de balde

## Impact
- Nova capability: `usage-analytics`
- Banco: novo model `Event`
- Código: chamadas de `trackEvent` em Server Actions e no cron de lembretes;
  parâmetro `src=notification` na URL aberta pela notificação
- Env nova: `ADMIN_USER_IDS`
- Fora do escopo: ferramentas externas (PostHog, GA), funis visuais, gráficos,
  eventos de navegação/pageview, exportação

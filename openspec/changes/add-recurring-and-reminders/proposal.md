# Change: Contas fixas recorrentes e lembrete diário

## Why
O maior risco do app é o abandono: o iniciante precisa lembrar de lançar cada
gasto, e metade do balde de Necessidades são contas que se repetem todo mês
(aluguel, luz, internet, parcelas). Hoje ele relança tudo manualmente, e no dia 1
o painel aparece "cheio" mesmo com boa parte do dinheiro já comprometido.

Este change ataca a dor do registro manual por dois lados:
1. **Contas fixas** entram sozinhas em todo ciclo, deixando o painel realista
   desde o primeiro dia do mês.
2. **Lembrete diário** via Web Push cria o hábito de registrar, com um
   contador de dias seguidos que valoriza também os dias sem gasto.

## What Changes
- Cadastro de contas fixas (descrição, valor, balde, dia do vencimento)
- Lançamento automático das contas fixas ao abrir cada novo ciclo mensal
- Opção de incluir uma conta fixa recém-cadastrada já no mês atual
- Edição/pausa/exclusão de conta fixa, afetando apenas ciclos futuros
- Opt-in de notificações push após o primeiro gasto salvo
- Lembrete diário no horário escolhido, que só é enviado se o usuário ainda
  não registrou nada no dia, e abre direto no lançamento
- Ação "Não gastei nada hoje" para registrar dias sem gasto
- Contador de dias seguidos no painel
- Painel indica quanto de cada balde já está comprometido com contas fixas

## Impact
- Novas capabilities: `recurring-expenses`, `daily-reminder`
- Capability alterada: `budget-dashboard` (novos requirements)
- Banco: novos models `RecurringExpense`, `PushSubscription`, `DailyCheckin`;
  novos campos em `Expense`, `BudgetCycle` e `UserSettings`
- Infra: chaves VAPID, endpoint de cron protegido por segredo, handlers de
  `push`/`notificationclick` no service worker
- Fora do escopo: notificação de vencimento de conta, parcelamentos com fim
  definido, renda recorrente variável, orçamento compartilhado

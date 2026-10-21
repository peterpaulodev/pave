# Change: Quanto posso gastar hoje

## Why
O painel mostra quanto resta em cada balde no mês ("faltam R$ 840 de lazer"), mas
para quem está começando esse número é abstrato: não diz se um café de R$ 15 hoje
cabe ou não. Transformar o saldo de Lazer em um valor diário dá uma resposta
direta para a decisão do momento e um retorno imediato a cada gasto.

## What Changes
- Valor diário de Lazer em destaque no topo do painel: saldo de Lazer no início
  do dia dividido pelos dias que faltam no mês, incluindo hoje
- Quanto já foi gasto em Lazer hoje e quanto ainda resta para hoje
- Estados para quando o limite do dia é ultrapassado e quando o balde de Lazer
  do mês acabou
- Explicação curta do cálculo ao tocar no valor
- Opção, nas configurações, de mostrar quanto resta para hoje no texto do lembrete
  diário (desativada por padrão, por privacidade na tela de bloqueio)

## Impact
- Capabilities alteradas: `budget-dashboard`, `daily-reminder` (novos requirements)
- Banco: novo campo `UserSettings.reminderShowAmount`
- Código: função pura de cálculo no domínio, nova query de componentes do saldo,
  card no painel, texto do lembrete no cron
- Fora do escopo: valor diário para Necessidades e Investimentos, metas de
  economia, histórico do valor diário

# Change: Resumo do mês

## Why
Quem está começando a controlar o dinheiro nunca viu o próprio mês consolidado.
Hoje o ciclo vira no dia 1 e o painel recomeça do zero, sem nenhum fechamento: o
usuário não sabe se o mês foi bom, onde o lazer foi parar nem quanto guardou.
Esse fechamento é o momento em que o app mostra seu valor e reforça o hábito de
registrar, e a primeira virada de ciclo real acontece em 1º de novembro.

## What Changes
- Resumo do mês anterior exibido automaticamente no primeiro acesso do novo mês
- Por balde: limite, total gasto e diferença (abaixo ou acima do limite)
- Investimentos apresentado como "quanto você guardou" em relação à meta de 20%
- Um destaque principal escolhido conforme o resultado do mês, em tom positivo
- Os 3 principais destinos do lazer, agrupando gastos de descrição parecida
- Quantos dias o usuário registrou no mês e quanto foi em contas fixas
- Link para rever o resumo no painel durante os primeiros 7 dias do mês
- Página de resumo de qualquer mês anterior do próprio usuário
- Evento de analytics `monthly_summary_viewed`

## Impact
- Nova capability: `monthly-summary`
- Banco: novo campo `UserSettings.lastSummarySeenPeriod`
- Código: função pura de montagem do resumo, query do ciclo anterior, tela de
  resumo, link no painel, novo evento no `EventMap`
- Fora do escopo: comparação com meses anteriores, gráficos, notificação push do
  resumo, exportação/compartilhamento como imagem, metas personalizadas

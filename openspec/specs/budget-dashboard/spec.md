# budget-dashboard Specification

## Purpose
TBD - created by archiving change add-mvp-503020. Update Purpose after archive.

## Requirements

### Requirement: Saldo por balde
O sistema SHALL exibir, para o mês atual, o valor disponível em
Necessidades (50%), Lazer (30%) e Investimentos (20%).

#### Scenario: Balde estourado
- **WHEN** os gastos de um balde ultrapassam o limite
- **THEN** o painel destaca o balde em alerta e mostra o valor excedido

#### Scenario: Saldo dentro do limite
- **WHEN** o usuário tem renda de R$ 5.000,00 e gastou R$ 800,00 em Necessidades
- **THEN** o painel exibe R$ 1.700,00 disponíveis em Necessidades
- **AND** exibe os saldos de Lazer e Investimentos com base nos gastos de cada um

#### Scenario: Mês sem gastos
- **WHEN** o usuário acessa o painel sem nenhum gasto no mês atual
- **THEN** cada balde exibe o limite cheio como disponível
- **AND** o painel exibe um atalho para registrar o primeiro gasto

### Requirement: Valor diário de lazer
O sistema SHALL exibir no topo do painel quanto o usuário pode gastar com lazer
hoje, calculado como o saldo de Lazer no início do dia dividido pelos dias que
faltam no mês, incluindo hoje, arredondado para baixo em centavos.

#### Scenario: Cálculo no meio do mês
- **WHEN** hoje é 21 de outubro, o limite de Lazer é R$ 1.500,00 e os gastos de Lazer até ontem somam R$ 1.050,00
- **THEN** o painel exibe "Hoje você pode gastar R$ 40,90 com lazer" (R$ 450,00 ÷ 11 dias)

#### Scenario: Contas fixas de lazer
- **WHEN** o usuário tem uma conta fixa de Lazer agendada para depois de hoje
- **THEN** o valor da conta fixa já é descontado do saldo usado no cálculo

#### Scenario: Último dia do mês
- **WHEN** hoje é o último dia do mês
- **THEN** o valor diário é todo o saldo de Lazer restante
- **AND** o painel indica que é o último dia do mês

### Requirement: Gasto do dia em relação ao valor diário
O sistema SHALL exibir quanto o usuário já gastou com lazer hoje e quanto ainda
resta para hoje, sem recalcular o valor diário por causa dos gastos do próprio dia.

#### Scenario: Gasto dentro do valor do dia
- **WHEN** o valor diário é R$ 42,00 e o usuário lança R$ 15,00 em Lazer hoje
- **THEN** o painel continua exibindo R$ 42,00 como valor de hoje
- **AND** exibe "Já gastou R$ 15,00 · resta R$ 27,00"

#### Scenario: Valor do dia ultrapassado
- **WHEN** o valor diário é R$ 42,00 e os gastos de Lazer de hoje somam R$ 50,00
- **THEN** o painel informa que o usuário passou R$ 8,00 do valor de hoje
- **AND** informa que o valor dos próximos dias se ajusta automaticamente

#### Scenario: Ajuste no dia seguinte
- **WHEN** o usuário ultrapassou o valor de ontem
- **THEN** o valor diário de hoje é calculado com o saldo já reduzido pelo excesso

#### Scenario: Balde de lazer esgotado
- **WHEN** o saldo de Lazer no início do dia é zero ou negativo
- **THEN** o painel informa que o lazer do mês acabou e volta no início do próximo mês

### Requirement: Explicação do valor diário
O sistema SHALL explicar, ao toque no valor diário, como ele é calculado, em
linguagem simples.

#### Scenario: Toque no valor
- **WHEN** o usuário toca no valor diário com 11 dias restantes no mês
- **THEN** o sistema exibe que o valor é o que sobra de lazer no mês dividido pelos 11 dias que faltam, contando hoje

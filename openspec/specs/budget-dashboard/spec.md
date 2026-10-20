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

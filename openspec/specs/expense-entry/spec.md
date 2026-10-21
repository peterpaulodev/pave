# expense-entry Specification

## Purpose

Registro rápido de gastos: permite lançar um gasto em poucos segundos digitando valor e descrição, com sugestão automática do balde, para manter o hábito de registrar sem atrito.

## Requirements

### Requirement: Lançamento rápido de gasto
O sistema SHALL permitir registrar um gasto informando valor e descrição
em uma única tela, em menos de 3 interações.

#### Scenario: Gasto com sugestão de balde
- **WHEN** o usuário digita "mercado 120"
- **THEN** o sistema registra R$ 120 e sugere o balde "Necessidades"
- **AND** o usuário pode confirmar ou trocar o balde com um toque

#### Scenario: Valor inválido
- **WHEN** o usuário informa um valor vazio ou negativo
- **THEN** o sistema bloqueia o registro e exibe uma mensagem de erro

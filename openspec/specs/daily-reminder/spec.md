# daily-reminder Specification

## Purpose
TBD - created by archiving change add-daily-allowance. Update Purpose after archive.

## Requirements

### Requirement: Valor de lazer no texto do lembrete
O sistema SHALL permitir que o usuário escolha mostrar no lembrete diário quanto
ainda resta de lazer para hoje, e MUST manter essa opção desativada até que o
usuário a ative.

#### Scenario: Opção desativada
- **WHEN** o lembrete é enviado a um usuário com a opção desativada
- **THEN** o texto é "Gastou algo hoje? Leva 5 segundos para registrar."

#### Scenario: Opção ativada com saldo para hoje
- **WHEN** o usuário ativou a opção e ainda resta R$ 27,00 de lazer para hoje
- **THEN** o texto é "Você ainda tem R$ 27,00 de lazer hoje. Gastou algo?"

#### Scenario: Opção ativada sem saldo para hoje
- **WHEN** o usuário ativou a opção e já passou do valor de hoje ou esgotou o lazer do mês
- **THEN** o texto do lembrete é o texto padrão

#### Scenario: Usuário sem ciclo no mês
- **WHEN** o lembrete é enviado e o usuário ainda não tem ciclo no mês atual
- **THEN** o sistema envia o texto padrão sem criar o ciclo

#### Scenario: Configuração
- **WHEN** o usuário ativa "Mostrar quanto sobra de lazer no lembrete" em Configurações
- **THEN** os próximos lembretes passam a incluir o valor quando houver saldo para hoje

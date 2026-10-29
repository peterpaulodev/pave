# monthly-summary Specification

## Purpose
TBD - created by archiving change add-monthly-summary. Update Purpose after archive.

## Requirements

### Requirement: Exibição automática do resumo
O sistema SHALL exibir o resumo do mês anterior no primeiro acesso ao painel no
novo mês, quando o usuário tiver um ciclo nesse mês com atividade registrada, e
MUST NOT exibi-lo automaticamente de novo depois que o usuário confirmar a leitura.

#### Scenario: Primeiro acesso do mês
- **WHEN** o usuário acessa o painel em 1º de novembro
- **AND** tem um ciclo de outubro com ao menos um gasto manual ou dia sem gasto
- **THEN** o sistema exibe o resumo de outubro

#### Scenario: Confirmação da leitura
- **WHEN** o usuário toca em "Começar novembro" no resumo
- **THEN** o sistema volta ao painel
- **AND** o resumo de outubro não é exibido automaticamente nos próximos acessos

#### Scenario: App fechado sem confirmar
- **WHEN** o usuário abre o resumo e fecha o app sem tocar em "Começar novembro"
- **THEN** o resumo é exibido de novo no próximo acesso ao painel

#### Scenario: Mês anterior sem atividade
- **WHEN** o ciclo do mês anterior não tem gasto manual nem dia sem gasto
- **THEN** o sistema não exibe o resumo automaticamente

#### Scenario: Sem ciclo no mês anterior
- **WHEN** o usuário não tem ciclo no mês anterior
- **THEN** o sistema abre o painel normalmente

### Requirement: Fechamento por balde
O sistema SHALL exibir, para cada balde do mês, o limite, o total gasto e a
diferença em relação ao limite, apresentando Investimentos como valor guardado em
relação à meta.

#### Scenario: Balde dentro do limite
- **WHEN** o limite de Lazer foi R$ 1.500,00 e os gastos somaram R$ 1.380,00
- **THEN** o resumo exibe que o Lazer ficou R$ 120,00 abaixo do planejado

#### Scenario: Balde acima do limite
- **WHEN** os gastos de Necessidades superaram o limite em R$ 200,00
- **THEN** o resumo exibe que Necessidades ficou R$ 200,00 acima do planejado, sem mensagem de culpa

#### Scenario: Investimentos
- **WHEN** a meta de Investimentos foi R$ 1.000,00 e o usuário registrou R$ 600,00 nesse balde
- **THEN** o resumo exibe "Você guardou R$ 600,00 de R$ 1.000,00"

#### Scenario: Contas fixas
- **WHEN** o mês teve R$ 1.700,00 em contas fixas
- **THEN** o resumo exibe o total de contas fixas do mês

### Requirement: Destaque do mês
O sistema SHALL exibir um único destaque principal, escolhido pela primeira regra
aplicável, na ordem: Necessidades e Lazer dentro do limite com a meta de guardar
atingida, meta de guardar atingida, lazer dentro do limite, registro em ao menos 70%
dos dias, primeiro mês concluído (ciclo iniciado depois do dia 1, sem ciclo de mês
anterior), mensagem padrão.

#### Scenario: Mês todo no azul
- **WHEN** Necessidades e Lazer ficaram dentro do limite e a meta de guardar foi atingida
- **THEN** o destaque é "Mês fechado no azul: todos os baldes dentro do planejado."

#### Scenario: Só a constância
- **WHEN** Lazer e Necessidades estouraram, a meta de guardar não foi atingida e o usuário registrou em 25 de 31 dias
- **THEN** o destaque é "Você registrou em 25 dos 31 dias. É assim que o controle funciona."

#### Scenario: Primeiro mês incompleto
- **WHEN** o ciclo começou no dia 15, o usuário não tem ciclo de mês anterior e nenhuma regra anterior se aplica
- **THEN** o destaque é "Primeiro mês concluído. Agora você sabe para onde vai seu dinheiro."

#### Scenario: Mês incompleto de quem já tinha ciclos
- **WHEN** o ciclo começou no dia 15 e o usuário tem ciclo de um mês anterior
- **AND** nenhuma regra anterior se aplica
- **THEN** o destaque é "Mês fechado. Cada mês registrado deixa o próximo mais fácil."

### Requirement: Destinos do lazer
O sistema SHALL exibir os até 3 destinos com maior soma no balde de Lazer,
agrupando gastos com descrições equivalentes, quando houver ao menos 2 gastos de
Lazer no mês.

#### Scenario: Agrupamento
- **WHEN** o mês teve "iFood 45", "ifood 30", "Cinema 60" e "IFOOD 25" em Lazer
- **THEN** o resumo exibe "iFood" com R$ 100,00 antes de "Cinema" com R$ 60,00

#### Scenario: Poucos gastos de lazer
- **WHEN** o mês teve menos de 2 gastos de Lazer
- **THEN** o resumo não exibe a seção de destinos do lazer

### Requirement: Constância e mês incompleto
O sistema SHALL exibir em quantos dias do mês o usuário registrou algo, contando
apenas a partir do início do ciclo quando ele começou depois do dia 1.

#### Scenario: Mês completo
- **WHEN** o usuário registrou gasto manual ou dia sem gasto em 22 dos 31 dias de outubro
- **THEN** o resumo exibe "Você registrou em 22 de 31 dias"

#### Scenario: Início no meio do mês
- **WHEN** o ciclo de outubro foi criado no dia 15
- **THEN** a contagem considera os 17 dias de 15 a 31
- **AND** o resumo informa que o acompanhamento começou no dia 15

### Requirement: Rever resumos
O sistema SHALL permitir rever o resumo de qualquer mês anterior do próprio
usuário e MUST NOT exibir resumos de outros usuários, do mês atual ou de meses
futuros.

#### Scenario: Link no painel
- **WHEN** o usuário acessa o painel entre os dias 1 e 7 e existe resumo do mês anterior
- **THEN** o painel exibe o link "Ver resumo de outubro"

#### Scenario: Mês antigo
- **WHEN** o usuário acessa o resumo de um mês anterior que tem ciclo
- **THEN** o sistema exibe o resumo sem alterar a confirmação de leitura do mês anterior

#### Scenario: Período inválido ou indisponível
- **WHEN** o período é inválido, é o mês atual, é futuro ou não tem ciclo do usuário
- **THEN** o sistema responde 404

### Requirement: Registro de visualização
O sistema SHALL registrar um evento de analytics a cada visualização do resumo,
indicando se foi exibido automaticamente, sem incluir período, valores ou destaque.

#### Scenario: Exibição automática
- **WHEN** o resumo é exibido no primeiro acesso do mês
- **THEN** o sistema registra `monthly_summary_viewed` com `auto` verdadeiro

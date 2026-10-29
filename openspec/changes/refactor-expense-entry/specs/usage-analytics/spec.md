## ADDED Requirements

### Requirement: Métricas da tela de lançamento
O sistema SHALL registrar, em cada gasto manual, se a descrição veio de um chip,
a origem do chip e o tempo entre a abertura da tela e o envio, e SHALL exibir no
painel de métricas o tempo mediano até salvar e a proporção de lançamentos feitos
com chip.

#### Scenario: Gasto com chip do histórico
- **WHEN** o usuário salva um gasto escolhendo um chip do próprio histórico após 4.230ms na tela
- **THEN** o evento `expense_created` registra `usedChip` verdadeiro, `chipSource` igual a `history` e `durationMs` igual a 4200

#### Scenario: Gasto com texto livre
- **WHEN** o usuário salva um gasto digitando a descrição em "Outro"
- **THEN** o evento registra `usedChip` falso e `chipSource` nulo

#### Scenario: Tempo inválido
- **WHEN** o servidor recebe um `durationMs` negativo, não inteiro ou maior que 600000
- **THEN** o gasto é registrado normalmente e o evento é gravado sem `durationMs`

#### Scenario: Métricas no painel
- **WHEN** o administrador abre o painel de métricas
- **THEN** são exibidos o tempo mediano até salvar e a proporção de lançamentos com chip, separando histórico e sugestões iniciais
- **AND** gastos sem `durationMs` não entram no cálculo da mediana

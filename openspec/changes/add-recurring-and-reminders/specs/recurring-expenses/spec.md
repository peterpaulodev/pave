## ADDED Requirements

### Requirement: Cadastro de conta fixa
O sistema SHALL permitir que o usuário cadastre uma conta fixa informando
descrição, valor, balde e dia do vencimento (1 a 31), com sugestão automática
de balde a partir da descrição.

#### Scenario: Cadastro válido
- **WHEN** o usuário cadastra "Aluguel", R$ 1.500,00, dia 10
- **THEN** o sistema salva a conta fixa como ativa
- **AND** sugere o balde "Necessidades", que o usuário pode trocar com um toque

#### Scenario: Dados inválidos
- **WHEN** o usuário informa valor vazio, zero ou negativo, descrição vazia ou dia fora de 1 a 31
- **THEN** o sistema não salva a conta fixa
- **AND** exibe a mensagem de erro do campo inválido

### Requirement: Inclusão no mês do cadastro
O sistema SHALL oferecer, no cadastro, a opção de lançar a conta fixa também no
mês atual, marcada por padrão quando o vencimento ainda não passou e desmarcada
quando já passou.

#### Scenario: Vencimento ainda não passou
- **WHEN** hoje é dia 5 e o usuário cadastra uma conta com vencimento no dia 10
- **THEN** a opção "Lançar também neste mês" aparece marcada
- **AND** ao salvar, o sistema cria o gasto no ciclo atual com data do dia 10

#### Scenario: Vencimento já passou
- **WHEN** hoje é dia 15 e o usuário cadastra uma conta com vencimento no dia 10
- **THEN** a opção "Lançar também neste mês" aparece desmarcada
- **AND** ao salvar sem marcar, o sistema não cria gasto no ciclo atual

### Requirement: Lançamento automático em cada ciclo
O sistema SHALL, ao criar um novo ciclo mensal, lançar automaticamente um gasto
para cada conta fixa ativa, exatamente uma vez por ciclo.

#### Scenario: Novo mês
- **WHEN** o usuário acessa o app no primeiro dia de um mês sem ciclo
- **AND** possui as contas fixas ativas "Aluguel" (dia 10) e "Internet" (dia 20)
- **THEN** o sistema cria o ciclo e lança os dois gastos com datas dos dias 10 e 20
- **AND** cada gasto fica vinculado à conta fixa de origem

#### Scenario: Dia inexistente no mês
- **WHEN** uma conta fixa tem vencimento no dia 31 e o mês tem 30 dias
- **THEN** o gasto é lançado no último dia do mês

#### Scenario: Conta fixa pausada
- **WHEN** uma conta fixa está pausada no momento da criação do ciclo
- **THEN** o sistema não lança gasto para ela nesse ciclo

#### Scenario: Acessos repetidos ou simultâneos
- **WHEN** o painel é acessado várias vezes, ou por dois requests ao mesmo tempo, no mesmo mês
- **THEN** cada conta fixa gera no máximo um gasto no ciclo

#### Scenario: Exclusão de um lançamento automático
- **WHEN** o usuário exclui o gasto automático de uma conta fixa no mês atual
- **THEN** o sistema não recria esse gasto no mesmo ciclo
- **AND** a conta fixa continua ativa para os próximos meses

### Requirement: Gestão de contas fixas
O sistema SHALL permitir editar, pausar, reativar e excluir uma conta fixa,
afetando apenas ciclos criados depois da alteração.

#### Scenario: Edição de valor
- **WHEN** o usuário altera o valor do "Aluguel" de R$ 1.500,00 para R$ 1.600,00
- **THEN** o gasto já lançado no mês atual permanece R$ 1.500,00
- **AND** os próximos ciclos lançam R$ 1.600,00

#### Scenario: Exclusão da conta fixa
- **WHEN** o usuário exclui uma conta fixa
- **THEN** os gastos já lançados por ela permanecem no histórico
- **AND** nenhum novo gasto é lançado nos próximos ciclos

#### Scenario: Isolamento entre usuários
- **WHEN** um usuário tenta editar ou excluir uma conta fixa de outro usuário
- **THEN** o sistema não encontra o registro e não altera nada

### Requirement: Identificação de gastos automáticos
O sistema SHALL identificar na lista de gastos os lançamentos de conta fixa e os
que vencem em data futura dentro do mês.

#### Scenario: Selos na lista
- **WHEN** o usuário vê a lista de gastos do mês
- **THEN** gastos de conta fixa exibem o selo "Fixa"
- **AND** gastos com data posterior a hoje exibem o selo "Agendado" com a data

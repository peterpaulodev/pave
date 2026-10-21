## ADDED Requirements

### Requirement: Valor comprometido com contas fixas
O sistema SHALL exibir, em cada balde do painel, quanto do limite já está
comprometido com contas fixas no mês, incluindo as que ainda vão vencer.

#### Scenario: Balde com contas fixas
- **WHEN** o balde Necessidades tem limite de R$ 2.500,00 e contas fixas de R$ 1.500,00 lançadas no mês
- **THEN** o card exibe "R$ 1.500,00 em contas fixas"
- **AND** o valor disponível já desconta as contas fixas, mesmo as agendadas para depois de hoje

#### Scenario: Balde sem contas fixas
- **WHEN** nenhum gasto do balde vem de conta fixa
- **THEN** o card não exibe a linha de contas fixas

### Requirement: Atalho para cadastrar contas fixas
O sistema SHALL exibir no painel um atalho para cadastrar contas fixas enquanto
o usuário não tiver nenhuma cadastrada.

#### Scenario: Usuário sem contas fixas
- **WHEN** o usuário acessa o painel sem nenhuma conta fixa cadastrada
- **THEN** o painel exibe o convite "Tem contas que se repetem todo mês? Cadastre uma vez e elas entram sozinhas"
- **AND** o convite leva à tela de contas fixas

#### Scenario: Usuário com contas fixas
- **WHEN** o usuário tem ao menos uma conta fixa cadastrada
- **THEN** o painel não exibe o convite

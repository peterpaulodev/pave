# onboarding Specification

## Purpose

Primeiro uso do app: coleta a renda mensal, mostra a divisão 50/30/20 resultante, cria o primeiro ciclo e condiciona o acesso às demais telas à conclusão desse passo, incentivando a instalação do PWA sem bloquear o fluxo.

## Requirements

### Requirement: Informar renda mensal
O sistema SHALL solicitar ao usuário recém-cadastrado a renda mensal líquida
em uma única tela, sem exigir nenhuma outra configuração (categorias, contas,
metas) para começar a usar o app.

#### Scenario: Renda válida
- **WHEN** o usuário informa "5.000,00" no campo de renda
- **THEN** o sistema armazena o valor como 500000 centavos
- **AND** habilita o botão de continuar

#### Scenario: Renda inválida
- **WHEN** o usuário informa um valor vazio, zero ou negativo
- **THEN** o sistema não permite continuar
- **AND** exibe a mensagem "Informe quanto você recebe por mês"

#### Scenario: Formatos de entrada aceitos
- **WHEN** o usuário digita "5000", "5.000", "5000,50" ou "5.000,50"
- **THEN** o sistema interpreta corretamente o valor em reais (pt-BR)

### Requirement: Prévia da divisão 50/30/20
O sistema SHALL exibir, antes da confirmação, quanto da renda vai para cada
balde, com uma explicação curta em linguagem simples de cada um.

#### Scenario: Cálculo dos baldes
- **WHEN** o usuário informa renda de R$ 5.000,00
- **THEN** o sistema exibe Necessidades R$ 2.500,00, Lazer R$ 1.500,00 e Investimentos R$ 1.000,00

#### Scenario: Arredondamento
- **WHEN** a renda não divide exatamente (ex.: R$ 1.234,57)
- **THEN** Necessidades e Lazer são arredondados para baixo em centavos
- **AND** Investimentos recebe a diferença, de modo que a soma dos três seja igual à renda

#### Scenario: Explicação dos baldes
- **WHEN** a prévia é exibida
- **THEN** cada balde mostra uma frase de exemplo (ex.: "Necessidades: aluguel, mercado, contas")

### Requirement: Conclusão do onboarding
O sistema SHALL, ao confirmar a renda, salvá-la como renda padrão do usuário,
criar o ciclo do mês atual e direcionar o usuário ao painel.

#### Scenario: Confirmação
- **WHEN** o usuário confirma a prévia
- **THEN** o sistema grava `default_income_cents` e `onboarded_at` em `user_settings`
- **AND** cria o `budget_cycle` do período atual (`YYYY-MM`, timezone do usuário) com os limites calculados
- **AND** redireciona para o painel

#### Scenario: Confirmação repetida
- **WHEN** a ação de confirmação é disparada mais de uma vez (duplo clique, retry de rede)
- **THEN** o sistema mantém apenas um ciclo para o período (idempotente)

### Requirement: Acesso condicionado ao onboarding
O sistema MUST impedir o acesso às telas do app enquanto o onboarding não
estiver concluído, e MUST NOT exibir o onboarding novamente após concluído.

#### Scenario: Usuário sem onboarding
- **WHEN** um usuário autenticado sem `onboarded_at` acessa o painel ou o lançamento
- **THEN** o sistema redireciona para `/onboarding`

#### Scenario: Usuário já onboardado
- **WHEN** um usuário com `onboarded_at` acessa `/onboarding`
- **THEN** o sistema redireciona para o painel

### Requirement: Incentivo à instalação do PWA
O sistema SHALL, ao final do onboarding, sugerir que o usuário adicione o app
à tela inicial, sem bloquear o fluxo.

#### Scenario: Sugestão dispensável
- **WHEN** o onboarding é concluído em um navegador mobile que permite instalação
- **THEN** o sistema exibe a sugestão de instalação com opção "Agora não"
- **AND** o usuário chega ao painel independentemente da escolha

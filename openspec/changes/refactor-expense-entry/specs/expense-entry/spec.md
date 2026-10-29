## MODIFIED Requirements

### Requirement: Lançamento rápido de gasto
O sistema SHALL permitir registrar um gasto em uma única tela, informando o valor
por um teclado numérico próprio e a descrição por um chip ou texto livre, com o
fluxo típico concluído em 3 passos: digitar o valor, escolher a descrição e salvar.

#### Scenario: Gasto com sugestão de balde
- **WHEN** o usuário digita 1, 2, 0, 0 no teclado e informa a descrição "mercado"
- **THEN** o sistema exibe R$ 12,00 e sugere o balde "Necessidades"
- **AND** o usuário pode confirmar ou trocar o balde com um toque

#### Scenario: Fluxo típico com chip
- **WHEN** o usuário digita 1, 2, 0, 0 no teclado, toca no chip "Mercado" e toca em salvar
- **THEN** o sistema registra um gasto de R$ 12,00 com a descrição "Mercado" no balde Necessidades, com a data de hoje

#### Scenario: Valor zerado ou descrição vazia
- **WHEN** o valor é R$ 0,00 ou nenhuma descrição foi escolhida
- **THEN** o botão de salvar fica desabilitado
- **AND** a tela indica o que falta preencher

#### Scenario: Valor inválido
- **WHEN** o servidor recebe um valor vazio, zero ou negativo
- **THEN** o sistema bloqueia o registro e exibe uma mensagem de erro

## ADDED Requirements

### Requirement: Teclado de valor
O sistema SHALL exibir o valor em destaque e um teclado numérico próprio em que
cada dígito entra pelas casas dos centavos, e MUST NOT abrir o teclado do sistema
para digitar o valor.

#### Scenario: Digitação estilo maquininha
- **WHEN** o usuário digita 1, 2, 0, 0
- **THEN** o valor exibido evolui para R$ 0,01, R$ 0,12, R$ 1,20 e R$ 12,00

#### Scenario: Apagar
- **WHEN** o valor é R$ 12,00 e o usuário toca em apagar
- **THEN** o valor passa a ser R$ 1,20

#### Scenario: Limpar tudo
- **WHEN** o usuário pressiona e segura o botão de apagar
- **THEN** o valor volta a R$ 0,00

#### Scenario: Limite de dígitos
- **WHEN** o valor já tem 9 dígitos e o usuário digita outro
- **THEN** o valor não muda

#### Scenario: Teclado físico
- **WHEN** o usuário usa um teclado físico e digita números, Backspace ou Enter
- **THEN** a tela responde como no teclado próprio, e Enter salva quando o botão está habilitado

### Requirement: Chips de descrição
O sistema SHALL exibir até 6 chips com as descrições mais usadas pelo usuário nos
gastos manuais dos últimos 90 dias, completando com sugestões iniciais quando não
houver histórico suficiente, e um chip "Outro" para texto livre.

#### Scenario: Usuário com histórico
- **WHEN** o usuário lançou "Mercado" 8 vezes, "iFood" 5 vezes e "Uber" 3 vezes nos últimos 90 dias
- **THEN** os primeiros chips são "Mercado", "iFood" e "Uber", nessa ordem

#### Scenario: Descrições equivalentes
- **WHEN** o histórico tem "ifood 30", "iFood" e "IFOOD"
- **THEN** elas formam um único chip com o rótulo "iFood"

#### Scenario: Usuário novo
- **WHEN** o usuário ainda não lançou nenhum gasto manual
- **THEN** os chips exibidos são Mercado, Transporte, Farmácia, Restaurante, Delivery e Assinaturas

#### Scenario: Seleção de chip
- **WHEN** o usuário toca no chip "iFood", cujo gasto mais recente foi em Lazer
- **THEN** a descrição passa a ser "iFood" e o balde Lazer é selecionado

#### Scenario: Texto livre
- **WHEN** o usuário toca em "Outro" e digita "padaria"
- **THEN** o sistema sugere o balde pela descrição digitada

#### Scenario: Texto com valor
- **WHEN** o valor está em R$ 0,00 e o usuário digita "padaria 12,50" no campo "Outro"
- **THEN** o valor passa a R$ 12,50 e a descrição fica "padaria"

### Requirement: Seletor de balde
O sistema SHALL exibir os três baldes como opções visuais com cor e ícone, com o
balde sugerido pré-selecionado e identificado, permitindo trocar com um toque.

#### Scenario: Balde do histórico
- **WHEN** o balde foi definido por um chip do histórico
- **THEN** o seletor indica "como da última vez"

#### Scenario: Balde sugerido
- **WHEN** o balde foi definido pela sugestão por palavra-chave ou por um chip inicial
- **THEN** o seletor indica "sugerido"

#### Scenario: Troca manual
- **WHEN** o usuário toca em outro balde
- **THEN** o balde tocado é selecionado e a indicação de sugestão some

### Requirement: Impacto no orçamento
O sistema SHALL exibir, enquanto o usuário preenche o gasto, o efeito do valor no
orçamento do balde selecionado, sem consultar o servidor a cada alteração.

#### Scenario: Lazer hoje
- **WHEN** resta R$ 27,00 de lazer para hoje e o usuário digita R$ 15,00 em Lazer com data de hoje
- **THEN** a tela exibe "Lazer hoje: resta R$ 27,00 → R$ 12,00"

#### Scenario: Necessidades
- **WHEN** há R$ 900,00 disponíveis em Necessidades e o usuário digita R$ 120,00 nesse balde
- **THEN** a tela exibe "Necessidades no mês: R$ 900,00 → R$ 780,00 disponível"

#### Scenario: Ultrapassa o disponível
- **WHEN** o valor digitado é maior que o disponível do balde
- **THEN** a tela informa quanto ficará acima do planejado, em tom neutro

### Requirement: Data do gasto
O sistema SHALL usar a data de hoje por padrão e permitir escolher ontem ou outra
data dentro do mês atual, e MUST NOT aceitar datas futuras ou de meses anteriores.

#### Scenario: Ontem
- **WHEN** o usuário toca em "Ontem" no dia 21
- **THEN** o gasto é registrado com a data do dia 20

#### Scenario: Primeiro dia do mês
- **WHEN** hoje é dia 1
- **THEN** a opção "Ontem" fica desabilitada com a indicação de que pertence ao mês anterior

#### Scenario: Data fora do permitido no servidor
- **WHEN** o servidor recebe uma data futura ou anterior ao primeiro dia do mês atual
- **THEN** o sistema rejeita o registro com erro de validação

### Requirement: Abertura da tela
O sistema SHALL abrir a tela de lançamento como painel deslizante sobre o painel
principal quando acionada pelo botão de novo gasto, e em tela cheia quando acessada
diretamente pelo endereço ou pela notificação.

#### Scenario: A partir do painel
- **WHEN** o usuário toca no botão de novo gasto no painel
- **THEN** a tela de lançamento abre como painel deslizante, com o painel principal visível por trás

#### Scenario: Fechar
- **WHEN** o usuário arrasta o painel deslizante para baixo ou usa o voltar do sistema
- **THEN** a tela de lançamento fecha sem registrar nada

#### Scenario: Acesso direto
- **WHEN** o usuário abre a tela de lançamento pela notificação ou recarrega a página
- **THEN** a tela de lançamento abre em tela cheia

### Requirement: Confirmação do lançamento
O sistema SHALL confirmar visualmente o gasto salvo e permitir desfazê-lo, mantendo
o rascunho quando o registro falhar.

#### Scenario: Salvo pelo painel deslizante
- **WHEN** o usuário salva um gasto de R$ 12,00 em "Mercado" pelo painel deslizante
- **THEN** o sistema exibe a confirmação, fecha o painel e mostra "Mercado · R$ 12,00 salvo" com a opção "Desfazer"
- **AND** o painel principal exibe os valores atualizados

#### Scenario: Salvo em tela cheia
- **WHEN** o usuário salva um gasto na tela cheia
- **THEN** o sistema exibe a confirmação com as opções "Lançar outro" e "Ir para o painel"

#### Scenario: Lançar outro
- **WHEN** o usuário toca em "Lançar outro"
- **THEN** o valor e a descrição são limpos e a data escolhida é mantida

#### Scenario: Falha ao salvar
- **WHEN** o registro falha
- **THEN** o sistema exibe a mensagem de erro e mantém o valor, a descrição, o balde e a data preenchidos

#### Scenario: Movimento reduzido
- **WHEN** o sistema operacional do usuário pede movimento reduzido
- **THEN** a confirmação é exibida sem animação

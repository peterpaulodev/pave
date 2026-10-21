## ADDED Requirements

### Requirement: Convite para ativar lembretes
O sistema SHALL convidar o usuário a ativar o lembrete diário somente após o
primeiro gasto salvo, sem bloquear o uso, e MUST NOT solicitar a permissão de
notificações do navegador sem um toque explícito do usuário.

#### Scenario: Após o primeiro gasto
- **WHEN** o usuário salva o primeiro gasto da conta
- **THEN** o sistema exibe o convite "Quer um lembrete diário para não esquecer?" com "Ativar" e "Agora não"

#### Scenario: Ativação
- **WHEN** o usuário toca em "Ativar" e concede a permissão no navegador
- **THEN** o sistema salva a inscrição de push do dispositivo
- **AND** ativa o lembrete às 20h no timezone do usuário

#### Scenario: Adiamento
- **WHEN** o usuário toca em "Agora não"
- **THEN** o convite não aparece novamente por 7 dias

#### Scenario: iPhone sem o app instalado
- **WHEN** o convite seria exibido no Safari do iOS fora do modo standalone
- **THEN** o sistema exibe a instrução "Toque em Compartilhar e depois em Adicionar à Tela de Início" em vez do botão "Ativar"

#### Scenario: Permissão negada
- **WHEN** a permissão de notificações está negada no navegador
- **THEN** o sistema não exibe o convite
- **AND** a tela de configurações explica como reativar nas configurações do navegador

### Requirement: Configuração do lembrete
O sistema SHALL permitir ativar, desativar e escolher o horário do lembrete
diário em uma tela de configurações.

#### Scenario: Troca de horário
- **WHEN** o usuário escolhe 22h
- **THEN** os próximos lembretes passam a ser enviados às 22h no timezone do usuário

#### Scenario: Desativação
- **WHEN** o usuário desativa o lembrete
- **THEN** o sistema não envia mais notificações para nenhum dispositivo dele

### Requirement: Envio do lembrete diário
O sistema SHALL enviar, uma vez por dia no horário escolhido, uma notificação
para os dispositivos inscritos do usuário que ainda não registrou nada no dia
local, e MUST NOT enviar mais de um lembrete por dia.

#### Scenario: Usuário sem registro no dia
- **WHEN** são 20h no timezone do usuário e ele não lançou gasto nem marcou "Não gastei nada hoje"
- **THEN** o sistema envia a notificação "Gastou algo hoje? Leva 5 segundos para registrar."

#### Scenario: Usuário já registrou
- **WHEN** são 20h e o usuário já lançou ao menos um gasto manual no dia
- **THEN** o sistema não envia a notificação

#### Scenario: Lançamento automático não conta
- **WHEN** o único gasto do dia é o lançamento automático de uma conta fixa
- **THEN** o sistema considera o dia como sem registro e envia a notificação

#### Scenario: Execução duplicada
- **WHEN** o agendamento dispara duas vezes na mesma hora
- **THEN** o usuário recebe no máximo uma notificação no dia

#### Scenario: Inscrição expirada
- **WHEN** o serviço de push responde que a inscrição não existe mais (404 ou 410)
- **THEN** o sistema remove a inscrição daquele dispositivo

#### Scenario: Endpoint protegido
- **WHEN** o endpoint de envio é chamado sem o segredo de agendamento
- **THEN** o sistema responde 401 e não envia nada

### Requirement: Abertura pela notificação
O sistema SHALL abrir a tela de lançamento rápido quando o usuário toca na
notificação do lembrete.

#### Scenario: Toque na notificação
- **WHEN** o usuário toca na notificação
- **THEN** o app abre (ou foca a janela já aberta) na tela de lançamento rápido com o campo em foco

### Requirement: Registro de dia sem gasto
O sistema SHALL permitir marcar "Não gastei nada hoje", registrando o dia como
cumprido sem criar gasto.

#### Scenario: Marcação pelo app
- **WHEN** o usuário toca em "Não gastei nada hoje" no painel
- **THEN** o sistema registra o dia local como cumprido
- **AND** o lembrete daquele dia não é enviado

#### Scenario: Marcação repetida
- **WHEN** o usuário marca "Não gastei nada hoje" mais de uma vez no mesmo dia
- **THEN** o sistema mantém um único registro para o dia

#### Scenario: Ação direto na notificação
- **WHEN** o navegador suporta ações em notificações e o usuário toca em "Não gastei nada"
- **THEN** o sistema registra o dia como cumprido sem abrir o app

### Requirement: Contador de dias seguidos
O sistema SHALL exibir no painel quantos dias seguidos o usuário registrou
(gasto manual ou dia sem gasto), sem zerar enquanto o dia atual ainda não terminou.

#### Scenario: Sequência ativa
- **WHEN** o usuário registrou algo em cada um dos últimos 5 dias, incluindo hoje
- **THEN** o painel exibe "5 dias seguidos"

#### Scenario: Hoje ainda sem registro
- **WHEN** o usuário registrou nos 4 dias anteriores e ainda não registrou hoje
- **THEN** o painel exibe "4 dias seguidos" com o convite para registrar hoje

#### Scenario: Sequência quebrada
- **WHEN** o usuário não registrou nada ontem nem hoje
- **THEN** o painel não exibe contador e mostra o convite para começar uma nova sequência

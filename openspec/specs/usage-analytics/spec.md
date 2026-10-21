# usage-analytics Specification

## Purpose

Métricas de uso do produto: registra eventos de uso no próprio banco, sem atrasar nem quebrar a ação do usuário e sem guardar descrição, valor ou texto livre, e os exibe num painel restrito aos administradores para mostrar onde está o atrito (onboarding, retenção, notificação e acerto da sugestão de balde).

## Requirements

### Requirement: Registro de eventos de uso
O sistema SHALL registrar eventos de uso associados ao usuário, sem atrasar nem
interromper a ação que os gerou, e MUST NOT incluir nos eventos a descrição, o
valor de gastos, a renda ou qualquer texto digitado pelo usuário.

#### Scenario: Ação do usuário com registro bem-sucedido
- **WHEN** o usuário conclui uma ação rastreada
- **THEN** o sistema responde ao usuário sem esperar a gravação do evento
- **AND** grava o evento com nome, usuário, data e propriedades permitidas

#### Scenario: Falha ao gravar o evento
- **WHEN** a gravação do evento falha
- **THEN** a ação do usuário é concluída normalmente
- **AND** o erro é registrado apenas no log do servidor

#### Scenario: Dados sensíveis
- **WHEN** um gasto "farmácia 89,90" é criado
- **THEN** o evento registrado não contém "farmácia" nem o valor 8990

#### Scenario: Exclusão do usuário
- **WHEN** um usuário é excluído
- **THEN** todos os eventos dele são removidos

### Requirement: Eventos de gasto
O sistema SHALL registrar, para cada gasto criado, a origem do lançamento, o balde
escolhido, o balde sugerido e se o usuário trocou a sugestão, com a sugestão
calculada no servidor.

#### Scenario: Lançamento rápido aceitando a sugestão
- **WHEN** o usuário lança "mercado 120" pela tela de lançamento e mantém o balde Necessidades
- **THEN** o sistema registra `expense_created` com origem `quick_entry`, balde e sugestão `needs` e `overridden` falso

#### Scenario: Troca da sugestão
- **WHEN** a sugestão é Necessidades e o usuário salva em Lazer
- **THEN** o evento registra `overridden` verdadeiro

#### Scenario: Lançamento a partir da notificação
- **WHEN** o usuário abre o app pela notificação do lembrete e salva um gasto
- **THEN** o evento registra a origem `notification`

#### Scenario: Lançamento automático de conta fixa
- **WHEN** uma conta fixa gera um gasto no ciclo
- **THEN** o evento registra a origem `recurring` e sugestão nula

### Requirement: Demais eventos rastreados
O sistema SHALL registrar a conclusão do onboarding, a exclusão de gastos, a
criação de contas fixas, a ativação e a desativação do lembrete, cada lembrete
enviado e cada dia marcado como sem gasto.

#### Scenario: Lembrete enviado
- **WHEN** o cron envia o lembrete diário a um usuário
- **THEN** o sistema registra um evento `reminder_sent` para ele

#### Scenario: Dia sem gasto pela notificação
- **WHEN** o usuário usa a ação "Não gastei nada" da notificação
- **THEN** o sistema registra `no_spend_checkin` com `via` igual a `notification`

### Requirement: Acesso restrito ao painel de métricas
O sistema MUST permitir o acesso à página `/admin` apenas a usuários listados na
configuração de administradores, e MUST responder como página inexistente aos demais.

#### Scenario: Administrador
- **WHEN** um usuário listado em `ADMIN_USER_IDS` acessa `/admin`
- **THEN** o sistema exibe o painel de métricas

#### Scenario: Usuário comum
- **WHEN** um usuário autenticado fora da lista acessa `/admin`
- **THEN** o sistema responde 404

#### Scenario: Sem sessão
- **WHEN** um visitante sem sessão acessa `/admin`
- **THEN** o sistema redireciona para o login

### Requirement: Métricas de produto
O sistema SHALL exibir, para a janela escolhida (7, 30 ou 90 dias), a conclusão do
onboarding, a retenção na semana 2, a proporção de lançamentos vindos da
notificação e a taxa de acerto da sugestão de balde, sempre com numerador,
denominador e percentual.

#### Scenario: Exibição com dados
- **WHEN** 3 de 5 usuários criados na janela concluíram o onboarding
- **THEN** a métrica de onboarding exibe "3/5 · 60%"

#### Scenario: Denominador zero
- **WHEN** não há dados suficientes para uma métrica
- **THEN** a métrica exibe "—" em vez de um percentual

#### Scenario: Retenção na semana 2
- **WHEN** um usuário concluiu o onboarding há 20 dias e registrou um gasto manual no dia 9 após o onboarding
- **THEN** ele conta como retido na coorte da janela

#### Scenario: Acerto da sugestão
- **WHEN** houve 10 gastos manuais com sugestão e 2 tiveram o balde trocado
- **THEN** a métrica exibe "8/10 · 80%"
- **AND** exibe ao lado a proporção de gastos manuais sem sugestão

#### Scenario: Dados dos administradores
- **WHEN** o painel é aberto com a opção padrão
- **THEN** os eventos dos administradores não entram nas métricas
- **AND** a opção "Incluir meus dados" passa a considerá-los

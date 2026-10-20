## Purpose

Fundação de interface mobile first da aplicação: garante que toda tela nasça otimizada para celular (viewport, áreas seguras, toque, navegação inferior) e se expanda de forma adequada em telas maiores, além de permitir instalação na tela inicial.

## ADDED Requirements

### Requirement: Viewport configurado para dispositivos móveis
A aplicação SHALL declarar um viewport com largura igual à do dispositivo, escala inicial 1 e `viewport-fit=cover`, e SHALL NOT desabilitar o zoom do usuário.

#### Scenario: Página carregada em um celular
- **WHEN** qualquer página é aberta em um navegador móvel
- **THEN** o conteúdo é renderizado na largura do dispositivo sem zoom-out automático nem rolagem horizontal

#### Scenario: Usuário tenta ampliar
- **WHEN** o usuário faz o gesto de pinça para ampliar
- **THEN** o navegador permite o zoom

### Requirement: Layout mobile first sem rolagem horizontal
Os estilos base SHALL ser escritos para a menor largura suportada (360px), e adaptações para telas maiores SHALL ser aplicadas apenas via breakpoints de largura mínima. Nenhuma página SHALL apresentar rolagem horizontal entre 320px e 1440px de largura.

#### Scenario: Tela estreita
- **WHEN** a página inicial é exibida com 320px de largura
- **THEN** todo o conteúdo cabe na largura e não há rolagem horizontal

#### Scenario: Tela larga
- **WHEN** a página inicial é exibida com 1280px de largura
- **THEN** o conteúdo principal fica centralizado com largura máxima limitada, sem esticar linhas de texto por toda a tela

### Requirement: Respeito às áreas seguras do dispositivo
Elementos fixos nas bordas da tela (cabeçalho e navegação inferior) SHALL aplicar espaçamento correspondente às áreas seguras do dispositivo, para que não fiquem sob o notch, a ilha dinâmica ou a barra de gestos.

#### Scenario: Aparelho com barra de gestos
- **WHEN** o app é aberto em um aparelho com área segura inferior diferente de zero
- **THEN** os itens da navegação inferior ficam totalmente acima da barra de gestos e continuam tocáveis

### Requirement: Alvos de toque acessíveis
Todo elemento interativo do shell (links de navegação, botões) SHALL ter área de toque de no mínimo 44×44 pixels CSS e SHALL exibir indicador de foco visível quando focado por teclado.

#### Scenario: Item de navegação
- **WHEN** a área de toque de um item da navegação inferior é medida
- **THEN** ela tem pelo menos 44px de largura e 44px de altura

#### Scenario: Navegação por teclado
- **WHEN** o usuário navega pelos itens com a tecla Tab
- **THEN** o item focado exibe um indicador de foco visível

### Requirement: Shell com cabeçalho e navegação inferior
A aplicação SHALL apresentar um shell comum às páginas com cabeçalho compacto, área de conteúdo rolável e navegação inferior fixa em telas pequenas. A navegação SHALL indicar visualmente e via atributo de acessibilidade (`aria-current="page"`) qual destino está ativo. O conteúdo SHALL NOT ficar escondido atrás do cabeçalho ou da navegação.

#### Scenario: Navegação entre destinos
- **WHEN** o usuário toca em um item da navegação inferior
- **THEN** a página correspondente é exibida e aquele item passa a ser marcado como ativo

#### Scenario: Final do conteúdo rolável
- **WHEN** o usuário rola até o fim de uma página longa
- **THEN** o último elemento do conteúdo fica totalmente visível acima da navegação inferior

#### Scenario: Tela de desktop
- **WHEN** a largura da tela é de pelo menos 1024px
- **THEN** a navegação continua acessível e o layout não se limita a uma coluna estreita fixada na parte inferior da tela

### Requirement: Aplicação instalável na tela inicial
A aplicação SHALL fornecer um Web App Manifest com nome, nome curto, `start_url`, `display: standalone`, cores de tema e de fundo, e ícones de 192px e 512px (incluindo um ícone `maskable`), além de ícone para iOS (apple-touch-icon) e `theme-color` declarado nas páginas.

#### Scenario: Manifest disponível
- **WHEN** um cliente requisita o manifest da aplicação
- **THEN** recebe um manifest válido com os campos e ícones exigidos

#### Scenario: Instalação em Android
- **WHEN** o usuário adiciona o app à tela inicial pelo Chrome no Android e o abre por lá
- **THEN** o app abre em modo standalone, sem a barra de endereço do navegador

### Requirement: Desempenho mínimo em mobile
A página inicial de produção SHALL atingir pontuação de pelo menos 90 em Performance e Acessibilidade no Lighthouse com perfil de emulação mobile.

#### Scenario: Auditoria Lighthouse
- **WHEN** o Lighthouse (modo mobile) é executado contra o build de produção da página inicial
- **THEN** as categorias Performance e Accessibility pontuam 90 ou mais

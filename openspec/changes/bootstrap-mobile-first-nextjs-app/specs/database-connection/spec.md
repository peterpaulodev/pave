## Purpose

Conexão da aplicação a um banco PostgreSQL gerenciado no NeonDB: define como as credenciais são fornecidas, como o schema evolui por migrations e como verificar se a aplicação alcança o banco.

## ADDED Requirements

### Requirement: Credenciais do banco via variáveis de ambiente
A aplicação SHALL obter as connection strings do banco exclusivamente de variáveis de ambiente: uma conexão pooled para consultas em runtime e uma conexão direta para migrations. Credenciais SHALL NOT ser versionadas no repositório, e o repositório SHALL conter um arquivo de exemplo documentando as variáveis exigidas sem valores reais.

#### Scenario: Arquivo de exemplo
- **WHEN** um desenvolvedor clona o repositório
- **THEN** encontra um `.env.example` listando as variáveis de conexão exigidas, com valores fictícios

#### Scenario: Arquivos de ambiente ignorados
- **WHEN** um arquivo `.env` ou `.env.local` com credenciais reais existe localmente
- **THEN** ele é ignorado pelo controle de versão

### Requirement: Falha explícita sem configuração de banco
Quando a variável de conexão de runtime estiver ausente, qualquer operação que precise do banco SHALL falhar com uma mensagem de erro que nomeia a variável faltante, em vez de um erro genérico de conexão.

#### Scenario: Variável ausente
- **WHEN** o servidor executa uma operação de banco sem a variável de conexão definida
- **THEN** o erro registrado informa o nome da variável de ambiente ausente

### Requirement: Evolução do schema por migrations versionadas
Alterações no schema do banco SHALL ser feitas por migrations versionadas no repositório, aplicáveis por scripts do projeto tanto em desenvolvimento quanto em implantação.

#### Scenario: Banco novo
- **WHEN** um desenvolvedor aponta a configuração para um banco Neon vazio e executa o script de aplicar migrations
- **THEN** o banco fica com o schema atual do projeto, sem passos manuais

### Requirement: Conexões compatíveis com execução serverless
A aplicação SHALL reutilizar um único cliente de banco por processo e SHALL NOT abrir novas conexões a cada recarga de código em desenvolvimento, evitando esgotar o limite de conexões do Neon.

#### Scenario: Hot reload em desenvolvimento
- **WHEN** o servidor de desenvolvimento recarrega módulos várias vezes seguidas
- **THEN** o número de clientes de banco instanciados não cresce a cada recarga

### Requirement: Health check do banco
A aplicação SHALL expor `GET /api/health`, que executa uma consulta trivial no banco e responde em JSON sem cache. Em sucesso, SHALL responder `200` com `{"status":"ok","database":"up"}`. Se o banco não responder, SHALL responder `503` com `{"status":"error","database":"down"}`. A resposta SHALL NOT expor connection strings, credenciais ou stack traces.

#### Scenario: Banco disponível
- **WHEN** um cliente chama `GET /api/health` com o banco acessível
- **THEN** recebe status `200` e corpo `{"status":"ok","database":"up"}`

#### Scenario: Banco indisponível
- **WHEN** um cliente chama `GET /api/health` e a conexão com o banco falha
- **THEN** recebe status `503` e corpo `{"status":"error","database":"down"}`, sem detalhes internos do erro

#### Scenario: Sem cache
- **WHEN** `GET /api/health` é chamado duas vezes e o estado do banco muda entre as chamadas
- **THEN** a segunda resposta reflete o estado atual do banco

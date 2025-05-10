# Briefing Técnico do Sistema de Interação WhatsApp

## 1. Visão Geral do Sistema

**Objetivo Principal:** Construir um sistema robusto para automação de interações com o WhatsApp, permitindo o envio e recebimento de mensagens, gerenciamento de conversas com IA e visualização em uma interface de usuário.

O sistema é composto por três componentes principais:

*   **`zap-backend` (Gateway WhatsApp):** Um serviço Node.js responsável exclusivamente pela comunicação direta com o WhatsApp (via `wppconnect`). Ele atua como um gateway, encaminhando mensagens e eventos.
    *   **Hospedagem:** Render.
*   **`Backend Bolt` (Lógica de Negócios e IA):** O cérebro do sistema. Responsável por processar as mensagens recebidas, interagir com a API da OpenAI, gerenciar o histórico de conversas no Supabase e coordenar as respostas.
    *   **Hospedagem/Implementação:** Pode ser implementado como Supabase Edge Functions (Deno/TypeScript) ou como um serviço Node.js separado (ex: no Render).
*   **`Frontend Bolt` (Interface do Usuário):** Uma aplicação web (React/Vite) para administradores ou usuários visualizarem o status da conexão WhatsApp, o QR Code e o histórico das conversas.
    *   **Hospedagem:** Netlify (ou Render Static Sites).

## 2. Arquitetura Detalhada dos Componentes

### 2.1. `zap-backend` (Gateway WhatsApp)

*   **Tecnologias Base:** Node.js, Express.js, `@wppconnect-team/wppconnect`, `puppeteer-core`, `ws` (para WebSocket Server).
*   **Responsabilidades:**
    *   Estabelecer e manter a conexão com o WhatsApp Web.
    *   Gerenciar eventos do `wppconnect` (QR Code, status da sessão, desconexão).
    *   Servir como um servidor WebSocket para:
        *   Transmitir QR Code e status da sessão para o `Frontend Bolt`.
        *   Receber mensagens de usuários do WhatsApp e encaminhá-las para o `Backend Bolt`.
        *   Receber respostas processadas do `Backend Bolt` e enviá-las para os usuários do WhatsApp.
    *   Expor um endpoint HTTP básico para health check.
*   **Comunicação:**
    *   Com WhatsApp: via `wppconnect`.
    *   Com `Backend Bolt`: via WebSocket (bidirecional).
    *   Com `Frontend Bolt`: via WebSocket (para QR/status).

### 2.2. `Backend Bolt` (Lógica de Negócios e IA)

*   **Tecnologias Base (Exemplo com Node.js):** Node.js, SDK do Supabase (`@supabase/supabase-js`), SDK da OpenAI (`openai`), cliente WebSocket (`ws`). (Se Edge Functions: Deno, SDKs equivalentes).
*   **Responsabilidades:**
    *   Conectar-se como cliente WebSocket ao `zap-backend` para receber mensagens do WhatsApp.
    *   Processar as mensagens recebidas:
        *   Interagir com a API da OpenAI (usando `OPENAI_API_KEY` e `OPENAI_ASSISTANT_ID`) para gerar respostas.
        *   Salvar o histórico da conversa (mensagens do usuário e respostas da IA) no banco de dados Supabase (tabela `conversation_logs`).
    *   Enviar a resposta gerada pela IA de volta para o `zap-backend` (via WebSocket) para ser entregue ao usuário do WhatsApp.
*   **Comunicação:**
    *   Com `zap-backend`: via WebSocket (bidirecional).
    *   Com Supabase: via SDK para leitura/escrita no banco de dados.
    *   Com OpenAI: via SDK para chamadas à API.

### 2.3. `Frontend Bolt` (Interface do Usuário)

*   **Tecnologias Base:** React, Vite, cliente WebSocket, SDK do Supabase (`@supabase/supabase-js`).
*   **Responsabilidades:**
    *   Conectar-se ao servidor WebSocket do `zap-backend` para:
        *   Receber e exibir o QR Code para autenticação do WhatsApp.
        *   Exibir o status da conexão com o WhatsApp.
    *   Conectar-se ao Supabase para:
        *   Autenticar usuários/administradores do dashboard (se aplicável).
        *   Inscrever-se em atualizações em tempo real (Supabase Realtime) da tabela `conversation_logs` para exibir o histórico das conversas.
        *   (Opcional) Chamar Supabase Edge Functions para outras funcionalidades administrativas.
*   **Comunicação:**
    *   Com `zap-backend`: via WebSocket.
    *   Com Supabase: via SDK (REST, Realtime, chamadas a Edge Functions).

## 3. Fluxo de Comunicação Principal (Exemplo de Mensagem)

1.  **`Frontend Bolt`** conecta-se ao WS do `zap-backend` e exibe o QR Code recebido.
2.  Usuário escaneia o QR Code com o app WhatsApp. `zap-backend` detecta a conexão e notifica o `Frontend Bolt` (via WS).
3.  Um usuário final envia uma mensagem para o número WhatsApp conectado.
4.  **`zap-backend`** (`wppconnect`) recebe a mensagem.
5.  **`zap-backend`** encaminha a mensagem (ex: `{ type: 'whatsapp_message', data: {...} }`) para o **`Backend Bolt`** via WebSocket.
6.  **`Backend Bolt`** recebe a mensagem:
    *   Salva a mensagem do usuário na tabela `conversation_logs` do Supabase.
    *   Chama a API da OpenAI para gerar uma resposta.
    *   Salva a resposta da OpenAI na tabela `conversation_logs` do Supabase.
    *   Envia a resposta da OpenAI (ex: `{ type: 'send_whatsapp_message', payload: { number: '...', message: '...' } }`) de volta para o **`zap-backend`** via WebSocket.
7.  **`Frontend Bolt`**, que está inscrito no Supabase Realtime para a tabela `conversation_logs`, recebe as novas mensagens (do usuário e da IA) e atualiza a interface da conversa.
8.  **`zap-backend`** recebe a payload do `Backend Bolt` e envia a mensagem de resposta para o usuário final no WhatsApp usando `wppconnect`.

## 4. Tecnologias Chave por Componente

*   **`zap-backend`:** Node.js, Express.js, @wppconnect-team/wppconnect, puppeteer-core, ws.
*   **`Backend Bolt`:** Node.js (ou Deno para Edge Functions), @supabase/supabase-js, openai (SDK), ws (cliente).
*   **`Frontend Bolt`:** React, Vite, ws (cliente), @supabase/supabase-js.

## 5. Configuração de Deploy e Hospedagem

*   **`zap-backend` (Render):**
    *   **Tipo:** Web Service.
    *   **Build Command:** `npm install && mkdir -p ./chrome_data && curl -SL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/chrome.deb && dpkg -x /tmp/chrome.deb ./chrome_data && rm /tmp/chrome.deb` (Exemplo, ajustar caminho em `executablePath`).
    *   **Start Command:** `node index.js`.
    *   **Persistência de Sessão:** Requer configuração de "Persistent Disk" no Render para o diretório da sessão do `wppconnect`.
*   **`Backend Bolt`:**
    *   **Opção 1: Supabase Edge Functions:** Deploy gerenciado pelo Supabase CLI junto com seu projeto Supabase.
    *   **Opção 2: Serviço Node.js no Render:** Similar ao `zap-backend`, mas sem as dependências do Chrome/wppconnect. Build: `npm install`, Start: `node server.js`.
*   **`Frontend Bolt` (Netlify):**
    *   **Build Command (Vite):** `npm run build`.
    *   **Publish directory:** `dist`.
    *   Configurar variáveis de ambiente no Netlify.
    *   (Alternativa: Render Static Sites).

## 6. Variáveis de Ambiente Cruciais

*   **`zap-backend` (Ex: no Render):**
    *   `PORT`: Fornecido pelo Render.
    *   `CHROME_EXEC_PATH`: Caminho para o executável do Chrome no ambiente de deploy (ex: `./chrome_data/opt/google/chrome/chrome`).
    *   `WPP_SESSION_NAME`: Nome da sessão do WhatsApp (ex: `bolt-session`).
    *   (Opcional) `WEBSOCKET_SHARED_SECRET`: Se implementar autenticação de WS com o `Backend Bolt`.
*   **`Backend Bolt` (Ex: Supabase Edge Function Secrets ou Render Env Vars):**
    *   `SUPABASE_URL`: URL do seu projeto Supabase.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Chave de serviço do Supabase.
    *   `OPENAI_API_KEY`: Sua chave da API OpenAI.
    *   `OPENAI_ASSISTANT_ID`: ID do seu assistente OpenAI.
    *   `ZAP_BACKEND_WS_URL`: URL do WebSocket do `zap-backend` (ex: `wss://your-zap-backend.onrender.com`).
    *   (Opcional) `WEBSOCKET_SHARED_SECRET`: Mesmo segredo do `zap-backend`.
*   **`Frontend Bolt` (Ex: Netlify Env Vars, prefixadas com `VITE_` para Vite):**
    *   `VITE_SUPABASE_URL`: URL do seu projeto Supabase.
    *   `VITE_SUPABASE_ANON_KEY`: Chave anônima pública do Supabase.
    *   `VITE_ZAP_BACKEND_WS_URL`: URL do WebSocket do `zap-backend`.

## 7. Briefing de Status do Projeto (Onde Estamos)

*   **`zap-backend`:**
    *   Estrutura base como gateway WhatsApp implementada (`index.js`).
    *   Comunicação WebSocket básica para envio de QR/Status e encaminhamento de mensagens (entrada/saída) definida.
    *   Lógica de Supabase e OpenAI foi removida com sucesso, focando no papel de gateway.
    *   **Próximo:** Configurar persistência de sessão no Render e, opcionalmente, autenticação de conexão WebSocket com o `Backend Bolt`.
*   **`Backend Bolt`:**
    *   Componente conceitualizado, arquitetura definida.
    *   **Próximo:** Precisa ser implementado (escolher entre Edge Function ou servidor Node.js). Desenvolver:
        *   Lógica de conexão WebSocket cliente persistente com o `zap-backend` (com tratamento de reconexão).
        *   Integração com SDK da OpenAI.
        *   Integração com SDK do Supabase para salvar/consultar `conversation_logs`.
*   **`Frontend Bolt`:**
    *   Aplicação React/Vite existente.
    *   **Próximo:** Precisa integrar/desenvolver:
        *   Conexão WebSocket com `zap-backend` para receber e exibir QR Code e status da sessão.
        *   Implementação da escuta do Supabase Realtime na tabela `conversation_logs` para exibir o histórico da conversa.
        *   (Opcional) Lógica de autenticação de usuário/administrador se o dashboard tiver acesso restrito.
*   **Supabase:**
    *   Estrutura da tabela `conversation_logs` precisa ser definida e criada.
    *   Políticas de Row Level Security (RLS) precisam ser implementadas para proteger os dados da conversa.

## 8. Pontos de Atenção e Próximos Passos Gerais

*   **Segurança:**
    *   Implementar RLS no Supabase é **crítico**.
    *   Considerar autenticação para a conexão WebSocket entre `zap-backend` e `Backend Bolt`.
    *   Gerenciar chaves de API e segredos de forma segura.
*   **Tratamento de Erros e Resiliência:**
    *   Implementar reconexão automática para o cliente WebSocket no `Backend Bolt`.
    *   Tratamento robusto de erros em todas as interações de API e WS.
    *   Mecanismos de retry para operações críticas.
*   **Gerenciamento de Estado no Frontend:**
    *   Utilizar uma biblioteca de gerenciamento de estado (Context API, Zustand, Redux) se a complexidade do `Frontend Bolt` crescer.
*   **Testes:** Desenvolver testes unitários e de integração para os componentes.
*   **Documentação:** Manter este briefing e outra documentação relevante atualizada.

## 9. Estrutura Original do Projeto `zap-backend` (Referência)

*   **`index.js`**: Ponto de entrada, configuração Express, inicialização `wppconnect`, rotas, servidor HTTP/WS.
*   **`package.json`**: Manifesto do projeto, scripts, dependências.
*   **`package-lock.json`**: Lockfile de dependências.
*   **`.env`**: Variáveis de ambiente locais (não versionado).
*   **`.gitignore`**: Arquivos ignorados pelo Git.
*   **`node_modules/`**: Dependências instaladas (não versionado).

---
*Este briefing será atualizado conforme o projeto evolui.*
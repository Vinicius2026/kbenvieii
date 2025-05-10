# Briefing Técnico: Projeto zap-backend

## 1. Visão Geral

**Nome do Projeto:** `zap-backend`

**Objetivo Principal:** Fornecer um serviço de backend para automação de interações com o WhatsApp. Ele permite o envio de mensagens e o monitoramento da conexão com o WhatsApp Web, sendo projetado para ser hospedado em plataformas como Render ou Railway.

## 2. Tecnologias Utilizadas

*   **Node.js:** Ambiente de execução JavaScript do lado do servidor.
*   **Express.js:** Framework web minimalista e flexível para Node.js, utilizado para criar a API RESTful.
*   **@wppconnect-team/wppconnect:** Biblioteca principal para conectar e interagir com o WhatsApp Web.
*   **Puppeteer-core:** Versão leve do Puppeteer, usada pelo `wppconnect` para controlar uma instância do Chrome (ou Chromium) e interagir com o WhatsApp Web. Exige que o Chrome/Chromium seja fornecido separadamente no ambiente de execução.
*   **dotenv:** Módulo para carregar variáveis de ambiente de um arquivo `.env` para `process.env`.
*   **cors:** Middleware para habilitar o Cross-Origin Resource Sharing, permitindo que o backend receba requisições de diferentes origens (frontends).

## 3. Estrutura do Projeto

*   **`index.js`**:
    *   **Função:** Ponto de entrada principal da aplicação.
    *   **Responsabilidades:**
        *   Carregar variáveis de ambiente (usando `dotenv`).
        *   Configurar e iniciar o servidor Express.
        *   Definir middlewares (como `cors` e `express.json`).
        *   Inicializar o cliente `wppconnect`, incluindo a configuração do `puppeteerOptions` com um caminho específico para o executável do Chrome (necessário para ambientes de deploy como o Render).
        *   Gerenciar eventos do `wppconnect` (ex: recebimento de QR Code, status da sessão).
        *   Definir rotas da API (ex: `GET /` para verificação de status, `POST /send-message` para enviar mensagens).
        *   Tratar erros e exceções não capturadas.
        *   Iniciar o servidor na porta especificada (via `process.env.PORT` ou um valor padrão).

*   **`package.json`**:
    *   **Função:** Arquivo de manifesto do projeto Node.js.
    *   **Conteúdo:**
        *   Metadados do projeto (nome, versão, etc.).
        *   Scripts NPM (ex: `start` para iniciar a aplicação com `node index.js`).
        *   Lista de dependências de produção (`dependencies`) e de desenvolvimento (`devDependencies`, se houver).

*   **`package-lock.json`**:
    *   **Função:** Registra as versões exatas das dependências instaladas, garantindo builds consistentes em diferentes ambientes.

*   **`.env`**:
    *   **Função:** Armazena variáveis de ambiente específicas do ambiente (local, desenvolvimento, produção).
    *   **Exemplo de Conteúdo:** `PORT=3000`
    *   **Importante:** Este arquivo não deve ser versionado no Git por questões de segurança (geralmente adicionado ao `.gitignore`).

*   **`.gitignore`**:
    *   **Função:** Especifica arquivos e pastas que devem ser intencionalmente ignorados pelo Git.
    *   **Exemplos Comuns:** `node_modules/`, `.env`, logs, arquivos de build temporários.

*   **`node_modules/`**:
    *   **Função:** Diretório onde o NPM instala todas as dependências listadas no `package.json`. Não é versionado.

## 4. Configuração para Deploy (Ex: Render/Railway)

*   **Dependência do Chrome:** Como `puppeteer-core` é utilizado, o Google Chrome (ou Chromium) precisa estar disponível no ambiente de execução.
*   **Build Command (Comando de Build):**
    *   Responsável por instalar as dependências do Node.js (`npm install`).
    *   Responsável por baixar e extrair o Google Chrome para um local específico no sistema de arquivos do container de deploy (ex: `/opt/render/project/.render/chrome`). O `index.js` referencia este caminho em `puppeteerOptions.executablePath`.
    *   Exemplo de comando: `npm install && mkdir -p /opt/render/project/.render/chrome && curl -SL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o /tmp/chrome.deb && dpkg -x /tmp/chrome.deb /opt/render/project/.render/chrome && rm /tmp/chrome.deb`

*   **Start Command (Comando de Início):**
    *   Comando que efetivamente inicia a aplicação após o build.
    *   Geralmente `npm start`, que por sua vez executa `node index.js` (conforme definido no `package.json`).

## 5. Fluxo da Aplicação

1.  **Inicialização:**
    *   O servidor Node.js é iniciado (`node index.js`).
    *   Variáveis de ambiente são carregadas.
    *   O servidor Express é configurado.
    *   O cliente `wppconnect` é inicializado.
        *   `puppeteer-core` tenta iniciar o Chrome usando o `executablePath` fornecido.
        *   Um QR Code é gerado (se não houver sessão salva) e logado no console (ou pode ser enviado para um frontend).
2.  **Autenticação:**
    *   O usuário escaneia o QR Code com o WhatsApp.
    *   O status da sessão muda para conectado.
3.  **Operação:**
    *   O backend fica escutando por requisições na API.
    *   Uma requisição `POST` para `/send-message` com `number` e `message` no corpo aciona o envio de uma mensagem via `wppconnect`.
4.  **Monitoramento:**
    *   Logs de status e erros são emitidos no console.

## 6. Pontos de Atenção e Próximos Passos Potenciais

*   **Gerenciamento de Sessão:** Considerar como a sessão do `wppconnect` será persistida entre reinícios do servidor (o `wppconnect` tem opções para isso).
*   **Tratamento de Erros:** Aprimorar o tratamento de erros e logging para facilitar a depuração.
*   **Segurança:** Revisar as configurações de segurança, especialmente se a API for exposta publicamente.
*   **Escalabilidade:** Avaliar a necessidade de escalabilidade dependendo da carga esperada.
*   **Frontend:** Se houver um frontend, garantir que a comunicação (ex: para exibir QR Code e receber status) seja eficiente.
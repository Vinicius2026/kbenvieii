require('dotenv').config();
const express = require('express');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;
  if (!global.wppClient) {
    return res.status(503).json({ success: false, error: 'Cliente WhatsApp não iniciado ou não pronto.' });
  }
  if (!number || !message) {
    return res.status(400).json({ success: false, error: 'Número e mensagem são obrigatórios.' });
  }
  try {
    await global.wppClient.sendText(number, message);
    console.log(`[APP_LOG] Mensagem enviada para ${number}`);
    res.json({ success: true, message: 'Mensagem enviada.' });
  } catch (error) {
    console.error(`[APP_LOG] Erro ao enviar mensagem para ${number}:`, error);
    res.status(500).json({ success: false, error: 'Falha ao enviar mensagem.' });
  }
});

app.get('/', (req, res) => {
  res.send('zap-backend está ativo e escutando! Render fará a mágica do WSS. QR e Status via WebSocket.');
});

// O Render define a variável PORT. Use '0.0.0.0' para o host.
const PORT = process.env.PORT || 3000; // 3000 é um fallback para dev local

// Crie um servidor HTTP padrão com seu app Express
const server = http.createServer(app);

// Crie o Servidor WebSocket atrelado a este servidor HTTP
const wss = new WebSocket.Server({ server });

let connectedClients = new Set();

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
  const originalProto = req.headers['x-forwarded-proto'];
  console.log(`[APP_LOG] Cliente WebSocket conectado! (IP: ${clientIp}, Protocolo original via Render: ${originalProto})`);
  connectedClients.add(ws);

  ws.on('message', async (messageText) => {
    console.log('[APP_LOG] Mensagem recebida do cliente WebSocket:', messageText.toString());
    try {
      const parsedMessage = JSON.parse(messageText.toString());

      if (parsedMessage.type === 'send_whatsapp_message' && parsedMessage.payload) {
        const { number, message: msgToSend } = parsedMessage.payload;

        if (!global.wppClient) {
          console.error('[APP_LOG] Tentativa de enviar mensagem via WS, mas cliente WhatsApp não está pronto.');
          ws.send(JSON.stringify({ type: 'send_status', success: false, error: 'Cliente WhatsApp não iniciado.' }));
          return;
        }
        if (!number || !msgToSend) {
          console.error('[APP_LOG] Número ou mensagem ausentes no payload do WebSocket.');
          ws.send(JSON.stringify({ type: 'send_status', success: false, error: 'Número e mensagem são obrigatórios no payload.' }));
          return;
        }

        try {
          await global.wppClient.sendText(number, msgToSend);
          console.log(`[APP_LOG] Mensagem enviada para ${number} via comando WebSocket.`);
          ws.send(JSON.stringify({ type: 'send_status', success: true, message: 'Mensagem enviada via WhatsApp.' }));
        } catch (error) {
          console.error(`[APP_LOG] Erro ao enviar mensagem para ${number} via WebSocket:`, error);
          ws.send(JSON.stringify({ type: 'send_status', success: false, error: 'Falha ao enviar mensagem via WhatsApp.', details: error.message }));
        }
      } else {
        console.log('[APP_LOG] Tipo de mensagem WebSocket não reconhecido ou payload ausente:', parsedMessage.type);
      }
    } catch (e) {
      console.error('[APP_LOG] Erro ao processar mensagem do cliente WebSocket (não é JSON válido?):', e.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Formato de mensagem inválido. Esperado JSON.' }));
    }
  });

  ws.on('close', () => {
    console.log('[APP_LOG] Cliente WebSocket desconectado.');
    connectedClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[APP_LOG] Erro no cliente WebSocket:', error);
    connectedClients.delete(ws); // Remove em caso de erro
  });
});

// Função para enviar dados para todos os clientes WebSocket conectados
function broadcast(data) {
  const jsonData = JSON.stringify(data);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
  console.log('[APP_LOG] Transmitindo dados para clientes WebSocket:', data.type);
}

// Inicie o servidor HTTP (que também hospeda o WebSocket Server)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[APP_LOG] Servidor rodando internamente na porta ${PORT} (HTTP e WS). O Render vai expor como HTTPS/WSS.`);
  initializeWppConnect(broadcast);
});

// Função para inicializar o WPPConnect
function initializeWppConnect(broadcastFunction) {
  console.log('[APP_LOG] Iniciando WPPConnect...');
wppconnect.create({
    session: process.env.WPP_SESSION_NAME || 'zap-session', // Nome da sessão
  catchQR: (qrBase64, asciiQR, attempt, urlCode) => {
      console.log('[APP_LOG] QR Code recebido! Tentativa:', attempt);
      broadcastFunction({ type: 'qr_code', data: qrBase64, asciiData: asciiQR, attempt: attempt });
  },
  statusFind: (statusSession, session) => {
      console.log('[APP_LOG] Status da sessão:', statusSession, '| Nome da sessão:', session);
      broadcastFunction({ type: 'session_status', data: statusSession, sessionName: session });
      if (statusSession === 'isConnected') {
        // Você pode querer transmitir algo extra quando conectado
        // broadcastFunction({ type: 'connection_update', status: 'connected', message: 'WhatsApp Conectado!'});
      }
  },
  puppeteerOptions: {
      executablePath: process.env.CHROME_EXEC_PATH, // DEVE SER CONFIGURADO NO RENDER
      args: [ // Argumentos recomendados para ambientes como o Render
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
      '--disable-gpu',
        '--disable-infobars', // Oculta a barra "Chrome está sendo controlado por software de teste automatizado"
        '--window-size=1280,720', // Define um tamanho de janela, pode ajudar em alguns casos
        // '--single-process', // DESCONTINUADO E PODE CAUSAR PROBLEMAS, EVITE SE POSSÍVEL
        // '--headless=new', // Se quiser forçar o novo modo headless (wppconnect pode gerenciar isso)
      ],
    },
    autoClose: 60000, // Tempo em ms para fechar o cliente se não houver conexão QR Code (padrão 60s)
    // headless: 'new', // Deixe o wppconnect gerenciar ou defina como true/'new' se necessário
    logQR: process.env.NODE_ENV !== 'production', // Loga QR no console apenas se não for produção
    browserArgs: ['--no-sandbox'] // Redundante com puppeteerOptions.args, mas garantindo.
  })
  .then((client) => {
    console.log('[APP_LOG] Cliente WPPConnect iniciado com sucesso!');
    global.wppClient = client; // Guarda o cliente globalmente para a rota /send-message

    client.onStateChange(state => {
      console.log('[APP_LOG] Estado da sessão WPPConnect alterado:', state);
      broadcastFunction({ type: 'session_state_change', data: state });
    });

    client.onDisconnected(reason => {
      console.log('[APP_LOG] Cliente WPPConnect desconectado. Razão:', reason);
      global.wppClient = null; // Limpa a referência global
      broadcastFunction({ type: 'connection_update', status: 'disconnected', reason: reason });
    });

    client.onMessage(async (message) => {
      console.log('[APP_LOG] Mensagem recebida no WhatsApp:', message.body);
      broadcastFunction({ type: 'whatsapp_message', data: message });
    });
  })
  .catch((error) => {
    console.error('[APP_LOG] Erro crítico ao iniciar cliente WPPConnect:', error);
    // Adicionar um broadcast aqui pode ser útil para o cliente saber do erro de inicialização
    broadcastFunction({ type: 'initialization_error', error: error.message || 'Falha ao iniciar WPPConnect' });
  });
}

// Função para encerramento gracioso do cliente WPPConnect
async function gracefulShutdown(signal) {
  console.log(`[APP_LOG] Recebido ${signal}. Encerrando cliente WPPConnect...`);
  if (global.wppClient) {
    try {
      await global.wppClient.close();
      console.log('[APP_LOG] Cliente WPPConnect encerrado com sucesso.');
    } catch (err) {
      console.error('[APP_LOG] Erro ao encerrar cliente WPPConnect:', err);
    }
  }
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[APP_LOG] Erro não tratado (uncaughtException):', err);
  // process.exit(1); // Comentado para evitar que o Render pare em erros menores durante o desenvolvimento
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[APP_LOG] Rejeição não tratada (unhandledRejection):', reason);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');
const puppeteer = require('puppeteer'); // Importado para obter caminho do Chromium

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend online!");
});

console.log('[APP_LOG] Iniciando o processo de criação do cliente wppconnect...');

// Caminho correto para o Chromium instalado
const chromiumPath = puppeteer.executablePath();

wppconnect.create({
  session: 'zap_ia_loop',
  catchQR: (qrBase64) => {
    console.log('[APP_LOG] QR code recebido:', qrBase64); // Você pode enviar esse QR para o frontend depois
  },
  statusFind: (statusSession, session) => {
    console.log('[APP_LOG] Status da sessão:', statusSession, 'Session name:', session);
  },
  puppeteerOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote'
    ],
    executablePath: chromiumPath
  },
  logQR: true,
}).then((client) => {
  console.log('[APP_LOG] Cliente wppconnect criado com sucesso!');

  app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    try {
      await client.sendText(`${number}@c.us`, message);
      res.send({ success: true });
    } catch (err) {
      console.error('[APP_LOG] Erro ao enviar mensagem:', err);
      res.status(500).send({ success: false, error: err.message });
    }
  });

  console.log('[APP_LOG] Endpoint /send-message configurado.');
}).catch((err) => {
  console.error('[APP_LOG] Erro ao criar cliente wppconnect:', err);
  // process.exit(1); // Descomente se quiser que o app pare em caso de erro aqui
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[APP_LOG] Servidor Express rodando e escutando na porta ${PORT} no host 0.0.0.0`);
});

process.on('uncaughtException', (err) => {
  console.error('[APP_LOG] Erro não tratado (uncaughtException):', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[APP_LOG] Rejeição não tratada (unhandledRejection):', reason);
});

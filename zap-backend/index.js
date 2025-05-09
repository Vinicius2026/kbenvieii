require('dotenv').config();
const express = require('express');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(cors());
app.use(express.json());

wppconnect.create({
  session: 'zap_ia_loop',
  catchQR: (qrBase64) => {
    console.log('QR code:', qrBase64); // você pode enviar pro frontend depois
  },
  statusFind: (statusSession) => {
    console.log('Status da sessão:', statusSession);
  },
}).then((client) => {
  app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    try {
      await client.sendText(`${number}@c.us`, message);
      res.send({ success: true });
    } catch (err) {
      res.status(500).send({ success: false, error: err.message });
    }
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT || 3000}`);
}); 
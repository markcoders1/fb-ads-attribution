require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT;

app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verified successfully');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification failed — token mismatch');
  return res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object !== 'instagram') {
    console.log('[Webhook] Not an Instagram event');
    console.log(body);
    return res.sendStatus(404);
  }

  body.entry?.forEach(entry => {
    entry.messaging?.forEach(event => {
      console.log('[DM Received]', JSON.stringify(event, null, 2));
    });
  });

  return res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});

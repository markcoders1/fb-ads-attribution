require('dotenv').config();
const express = require('express');
const IORedis = require('ioredis');
const { Queue } = require('bullmq');

const { QUEUE_NAME } = require('./lib/constants');
const { verifyMetaSignature } = require('./lib/metaSignature');
const { pool, latestDmForSender } = require('./lib/db');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT;
const META_APP_SECRET = process.env.META_APP_SECRET;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

if (process.env.NODE_ENV === 'production') {
  if (!META_APP_SECRET) {
    console.error('[Config] META_APP_SECRET is required in production');
    process.exit(1);
  }
  if (!process.env.REDIS_URL) {
    console.error('[Config] REDIS_URL is required in production');
    process.exit(1);
  }
}

const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const dmQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

const app = express();

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1 AS ok');
    const pong = await redisConnection.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Health]', err);
    res.status(503).json({ ok: false });
  }
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verified successfully');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification failed — token mismatch');
  return res.sendStatus(403);
});

app.post(
  '/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    const rawBody = req.body;
    const signature = req.get('X-Hub-Signature-256');

    if (META_APP_SECRET) {
      if (!verifyMetaSignature(rawBody, signature, META_APP_SECRET)) {
        console.warn('[Webhook] Invalid signature');
        return res.sendStatus(403);
      }
    } else {
      console.warn('[Webhook] META_APP_SECRET unset — signature not verified');
    }

    let body;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.sendStatus(400);
    }

    if (body.object !== 'instagram') {
      console.log('[Webhook] Not an Instagram event');
      return res.sendStatus(404);
    }

    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const events = entry.messaging || [];
        for (const event of events) {
          if(!event?.referral?.ad_id)console.log("[META Webhook] No referral data in message",JSON.stringify(event,null,2));
          if (!event?.message?.mid || event?.read?.mid) continue;
          await dmQueue.add(
            'save-dm',
            { event },
            {
              attempts: 8,
              backoff: { type: 'exponential', delay: 1500 },
              removeOnComplete: { count: 5000 },
              removeOnFail: { count: 10000 },
            }
          );
        }
      }
      return res.sendStatus(200);
    } catch (err) {
      console.error('[Webhook] Queue error', err);
      return res.sendStatus(503);
    }
  }
);

app.use(express.json());

app.post('/webhook-manychats', async (req, res) => {
  const igId = req.body?.ig_id;
  if (igId == null || igId === '') {
    return res.status(400).json({ error: 'ig_id required' });
  }

  try {
    const data = await latestDmForSender(String(igId));
    console.log(data);
    console.log("[ManyChat webhook] data sent",data);
    return res.status(200).json({ data });
  } catch (err) {
    console.error('[ManyChat webhook]', err);
    return res.status(500).json({ error: 'database_error' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});

async function shutdown(signal) {
  console.log(`[Server] ${signal}, closing…`);
  server.close(async () => {
    try {
      await dmQueue.close();
      await redisConnection.quit();
      await pool.end();
      console.log('[Server] Clean exit');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Shutdown error', err);
      process.exit(1);
    }
  });
  setTimeout(() => {
    console.error('[Server] Forced exit after timeout');
    process.exit(1);
  }, 15_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

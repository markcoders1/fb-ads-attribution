require('dotenv').config();
const IORedis = require('ioredis');
const { Worker } = require('bullmq');

const { QUEUE_NAME } = require('./lib/constants');
const { extractDmPayload } = require('./lib/dmPayload');
const { insertInstagramDm } = require('./lib/db');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const WORKER_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.WORKER_CONCURRENCY || '20', 10)
);

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const event = job.data?.event;
    const payload = extractDmPayload(event);
    if (!payload) {
      return { skipped: true };
    }
    const inserted = await insertInstagramDm(payload);
    return { inserted: !!inserted, mid: payload.message_mid };
  },
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
  }
);

worker.on('completed', (job, result) => {
  if (result?.inserted) {
    console.log('[Worker] Saved', result.mid, job.id);
  }
});

worker.on('failed', (job, err) => {
  console.error('[Worker] Failed', job?.id, err);
});

console.log(
  `[Worker] Listening queue="${QUEUE_NAME}" concurrency=${WORKER_CONCURRENCY}`
);

function shutdown(signal) {
  console.log(`[Worker] ${signal}, closing…`);
  worker
    .close()
    .then(() => connection.quit())
    .then(() => {
      console.log('[Worker] Stopped');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Worker] Shutdown error', err);
      process.exit(1);
    });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

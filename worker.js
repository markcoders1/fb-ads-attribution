require('dotenv').config();
const IORedis = require('ioredis');
const { Worker } = require('bullmq');

const { QUEUE_NAME } = require('./lib/constants');
const { extractDmPayload } = require('./lib/dmPayload');
const { insertInstagramDm } = require('./lib/db');
const { fetchCampaignAndAdsetFromAdId } = require('./lib/metaMarketing');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN
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
    if (payload.ad_id && FB_ACCESS_TOKEN) {
      const ids = await fetchCampaignAndAdsetFromAdId(payload.ad_id, FB_ACCESS_TOKEN);
      payload.campaign_id = ids.campaign_id;
      payload.adset_id = ids.adset_id;
    } else {
      payload.campaign_id = null;
      payload.adset_id = null;
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

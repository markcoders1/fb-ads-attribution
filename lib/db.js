const { Pool } = require('pg');
const { configDotenv } = require("dotenv");
configDotenv({path: './../.env'});

const DATABASE_URL = process.env.DATABASE_URL;
const PG_POOL_MAX = Math.max(1, Number.parseInt(process.env.PG_POOL_MAX || '10', 10));

if (!DATABASE_URL) {
  console.error('[Config] DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: PG_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[Postgres] Unexpected idle client error', err);
});

async function insertInstagramDm(payload) {
  const sql = `
    INSERT INTO instagram_dms (
      sender_id,
      recipient_id,
      message_at,
      message_mid,
      message_text,
      referral_source,
      referral_type,
      ad_id,
      campaign_id,
      adset_id,
      referral_json,
      raw_event
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
    ON CONFLICT (message_mid) DO NOTHING
    RETURNING id
  `;
  const values = [
    payload.sender_id,
    payload.recipient_id,
    payload.message_at,
    payload.message_mid,
    payload.message_text,
    payload.referral_source,
    payload.referral_type,
    payload.ad_id,
    payload.campaign_id ?? null,
    payload.adset_id ?? null,
    payload.referral_json ? JSON.stringify(payload.referral_json) : null,
    JSON.stringify(payload.raw_event),
  ];
  const result = await pool.query(sql, values);
  return result.rowCount > 0 ? result.rows[0] : null;
}

async function latestDmForSender(senderId) {
  const result = await pool.query(
    `
    SELECT
      id,
      sender_id,
      recipient_id,
      message_at,
      message_mid,
      message_text,
      referral_source,
      referral_type,
      ad_id,
      campaign_id,
      adset_id,
      referral_json,
      raw_event,
      created_at
    FROM instagram_dms
    WHERE sender_id = $1
    ORDER BY message_at DESC, id DESC
    LIMIT 1
    `,
    [senderId]
  );
  return result.rows[0] ?? null;
}

module.exports = {
  pool,
  insertInstagramDm,
  latestDmForSender,
};

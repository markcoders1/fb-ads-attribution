-- Apply: psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS instagram_dms (
  id BIGSERIAL PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  message_at TIMESTAMPTZ NOT NULL,
  message_mid TEXT NOT NULL,
  message_text TEXT,
  referral_source TEXT,
  referral_type TEXT,
  ad_id TEXT,
  campaign_id TEXT,
  adset_id TEXT,
  referral_json JSONB,
  raw_event JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT instagram_dms_message_mid_key UNIQUE (message_mid)
);

CREATE INDEX IF NOT EXISTS instagram_dms_sender_message_at_idx
  ON instagram_dms (sender_id, message_at DESC, id DESC);

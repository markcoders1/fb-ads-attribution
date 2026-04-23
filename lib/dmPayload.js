const { nullableString } = require('./nullable');

function messageAtFromEvent(event) {
  const ts = event.timestamp;
  if (typeof ts !== 'number' || Number.isNaN(ts)) return null;
  return new Date(ts);
}

function normalizeReferral(referral) {
  if (!referral) {
    return {
      referral_source: null,
      referral_type: null,
      ad_id: null,
      referral_json: null,
    };
  }
  return {
    referral_source: nullableString(referral.source),
    referral_type: nullableString(referral.type),
    ad_id: nullableString(referral.ad_id),
    referral_json: referral,
  };
}

/** Returns a row payload or null if this messaging event is not a persistable DM. */
function extractDmPayload(event) {
  const msg = event.message;
  if (!msg?.mid || !event.sender?.id || !event.recipient?.id) return null;

  const messageAt = messageAtFromEvent(event);
  if (!messageAt) return null;

  const referralFields = normalizeReferral(msg.referral);

  return {
    sender_id: String(event.sender.id),
    recipient_id: String(event.recipient.id),
    message_at: messageAt,
    message_mid: msg.mid,
    message_text: typeof msg.text === 'string' ? msg.text : null,
    ...referralFields,
    raw_event: event,
  };
}

module.exports = {
  extractDmPayload,
  messageAtFromEvent,
  normalizeReferral,
};

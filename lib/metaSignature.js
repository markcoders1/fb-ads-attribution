const crypto = require('crypto');

/**
 * Verifies Meta X-Hub-Signature-256 (HMAC-SHA256 over raw body).
 * @param {Buffer} rawBody
 * @param {string|undefined} signatureHeader - `sha256=<hex>`
 */
function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return false;
  if (!signatureHeader || !Buffer.isBuffer(rawBody)) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const a = Buffer.from(signatureHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { verifyMetaSignature };

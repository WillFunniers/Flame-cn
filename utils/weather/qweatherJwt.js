const crypto = require('crypto');
const fs = require('fs');

/**
 * Dynamic Ed25519 (EdDSA) JWT minting for the QWeather provider.
 *
 * Node built-ins only (crypto + fs) — no dependency, no static JWT env var.
 * The token is always minted at runtime from the operator's PEM private key.
 *
 * SECURITY: nothing in this module ever logs or returns key material, the API
 * key, the token's claims values, or the key file path. Errors carry a fixed
 * message only (plus a filesystem errno code at most).
 */
const AUTH_JWT = 'jwt';

/** Token lifetime, the iat back-dating, and the renewal window (contract v1). */
const TOKEN_TTL_SECONDS = 900;
const CLOCK_SKEW_SECONDS = 30;
const RENEW_BEFORE_SECONDS = 60;

const readEnv = (key) => (process.env[key] || '').trim();

/** JWT header `kid` (Credential ID). */
const getKeyId = () => readEnv('QWEATHER_KEY_ID');

/** JWT payload `iss` (Developer ID). */
const getDeveloperId = () => readEnv('QWEATHER_DEVELOPER_ID');

/** JWT payload `sub` (Project ID). */
const getProjectId = () => readEnv('QWEATHER_PROJECT_ID');

/** Absolute path of the Ed25519 private key PEM file. */
const getPrivateKeyPath = () => readEnv('QWEATHER_PRIVATE_KEY_PATH');

/**
 * The JWT mode is usable only when every claim source and the key file path
 * are present. The file itself is validated lazily, when a token is needed.
 */
const isJwtConfigured = () =>
  Boolean(getKeyId() && getDeveloperId() && getProjectId() && getPrivateKeyPath());

// --- module level caches (cleared by resetCache) ---------------------------
let cachedKey = null;
let cachedKeyPath = '';
let cachedToken = null; // { token, exp }

/**
 * Reads + validates the Ed25519 private key, caching it until resetCache() or
 * until QWEATHER_PRIVATE_KEY_PATH points somewhere else.
 */
const loadPrivateKey = () => {
  if (!isJwtConfigured()) {
    throw new Error('QWeather JWT is not configured');
  }

  const keyPath = getPrivateKeyPath();

  if (cachedKey && cachedKeyPath === keyPath) {
    return cachedKey;
  }

  // Dropped on any failure so a fixed file / path is picked up on the next call.
  cachedKey = null;
  cachedKeyPath = '';

  let pem;

  try {
    pem = fs.readFileSync(keyPath);
  } catch (err) {
    const code = err && err.code ? ` (${err.code})` : '';
    throw new Error(`QWeather JWT private key is not readable${code}`);
  }

  let key;

  try {
    key = crypto.createPrivateKey({ key: pem, format: 'pem' });
  } catch (err) {
    throw new Error('QWeather JWT private key is invalid');
  }

  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error('QWeather JWT private key is not an Ed25519 key');
  }

  cachedKey = key;
  cachedKeyPath = keyPath;

  return key;
};

/** Unpadded Base64URL of a JSON-serialisable value (Node >= 15). */
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * Mints a fresh token. Never cached (getToken owns the cache).
 * @returns {{ token: string, iat: number, exp: number }}
 */
const signToken = ({ now = Date.now() } = {}) => {
  const privateKey = loadPrivateKey();

  const nowSec = Math.floor(now / 1000);
  const iat = nowSec - CLOCK_SKEW_SECONDS;
  const exp = iat + TOKEN_TTL_SECONDS;

  // Exactly these two keys, in this order.
  const header = { alg: 'EdDSA', kid: getKeyId() };
  // Exactly these four keys, in this order.
  const payload = { iss: getDeveloperId(), sub: getProjectId(), iat, exp };

  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  const signature = crypto.sign(null, Buffer.from(signingInput, 'utf8'), privateKey);

  return {
    token: `${signingInput}.${signature.toString('base64url')}`,
    iat,
    exp,
  };
};

/**
 * Returns a cached token while it is still comfortably valid, otherwise mints
 * and caches a new one (new iat / exp).
 */
const getToken = ({ now = Date.now() } = {}) => {
  const nowSec = Math.floor(now / 1000);

  if (cachedToken && cachedToken.exp - nowSec >= RENEW_BEFORE_SECONDS) {
    return cachedToken.token;
  }

  const signed = signToken({ now });
  cachedToken = { token: signed.token, exp: signed.exp };

  return signed.token;
};

/** Drops the cached token AND the cached private key (tests / key rotation). */
const resetCache = () => {
  cachedToken = null;
  cachedKey = null;
  cachedKeyPath = '';
};

/** Cache metadata only — never the token itself. */
const getCacheInfo = () => ({
  cached: Boolean(cachedToken),
  exp: cachedToken ? cachedToken.exp : null,
  keyLoaded: Boolean(cachedKey),
});

module.exports = {
  AUTH_JWT,
  TOKEN_TTL_SECONDS,
  CLOCK_SKEW_SECONDS,
  RENEW_BEFORE_SECONDS,
  getKeyId,
  getDeveloperId,
  getProjectId,
  getPrivateKeyPath,
  isJwtConfigured,
  signToken,
  getToken,
  resetCache,
  getCacheInfo,
};

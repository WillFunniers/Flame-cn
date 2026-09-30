'use strict';

/**
 * Unit tests for `utils/weather/qweatherJwt.js`.
 *
 * Source of truth: build-logs/qweather-jwt-contract.md (FROZEN) — items 1..10.
 *
 * Runner (contract §6):
 *   node --test "utils/weather/__tests__/*.test.js"
 * The glob form is required on the Node >= 22 host; the directory form
 * `node --test utils/weather/__tests__/` is treated as a literal file path and
 * only discovers these files on Node 20 (the container).
 *
 * Hermetic: the Ed25519 keypair is generated in-process, the private PEM is
 * written to a fresh 0700 temp dir with mode 0600, and removed in `after`.
 * Every test snapshots and restores the complete process.env.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const jwt = require('../qweatherJwt');

const ENV_KEYS = [
  'QWEATHER_API_HOST',
  'QWEATHER_AUTH_MODE',
  'QWEATHER_KEY_ID',
  'QWEATHER_DEVELOPER_ID',
  'QWEATHER_PROJECT_ID',
  'QWEATHER_PRIVATE_KEY_PATH',
  'QWEATHER_API_KEY',
  'QWEATHER_JWT',
];

const KID = 'test-credential-id-7f3a';
const ISS = 'test-developer-id-9b21';
const SUB = 'test-project-id-4c8e';
const FIXED_NOW = 1700000000000; // 2023-11-14T22:13:20.000Z
const FIXED_NOW_SEC = Math.floor(FIXED_NOW / 1000);

let envSnapshot = {};
let tmpDir = '';
let primary = null;
let secondary = null;
let rsaPair = null;
let primaryPath = '';
let secondaryPath = '';

const snapshotEnv = () => {
  envSnapshot = { ...process.env };
};

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, envSnapshot);
};

const clearQweatherEnv = () => {
  for (const key of ENV_KEYS) delete process.env[key];
};

const setJwtEnv = (overrides = {}) => {
  process.env.QWEATHER_KEY_ID = KID;
  process.env.QWEATHER_DEVELOPER_ID = ISS;
  process.env.QWEATHER_PROJECT_ID = SUB;
  process.env.QWEATHER_PRIVATE_KEY_PATH = primaryPath;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const newKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return { publicKey, privateKey, pem: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
};

const writePem = (name, pem) => {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, pem, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
};

const pemBody = (pem) =>
  pem
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('-----'))
    .join('');

const decodeSegment = (segment) => JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));

const decodeToken = (token) => {
  const parts = token.split('.');
  return {
    parts,
    header: decodeSegment(parts[0]),
    payload: decodeSegment(parts[1]),
    signature: Buffer.from(parts[2], 'base64url'),
  };
};

const verifyToken = (token, publicKey) => {
  const [header, payload, signature] = token.split('.');
  return crypto.verify(
    null,
    Buffer.from(`${header}.${payload}`, 'utf8'),
    publicKey,
    Buffer.from(signature, 'base64url')
  );
};

/** Assert an error message never contains key material or env values. */
const assertNoSecretLeak = (message, extra = []) => {
  const forbidden = [
    KID,
    ISS,
    SUB,
    primaryPath,
    secondaryPath,
    pemBody(primary.pem),
    pemBody(secondary.pem),
    ...extra,
  ];
  for (const value of forbidden) {
    if (!value) continue;
    assert.equal(
      message.includes(value),
      false,
      'error message must not contain key material or environment values'
    );
  }
};

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qw-'));
  fs.chmodSync(tmpDir, 0o700);
  primary = newKeyPair();
  secondary = newKeyPair();
  rsaPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  primaryPath = writePem('primary-ed25519.pem', primary.pem);
  secondaryPath = writePem('secondary-ed25519.pem', secondary.pem);
  assert.equal(fs.statSync(primaryPath).mode & 0o777, 0o600);
});

after(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  snapshotEnv();
  clearQweatherEnv();
  setJwtEnv();
  jwt.resetCache();
});

afterEach(() => {
  jwt.resetCache();
  restoreEnv();
});

describe('qweatherJwt — module surface', () => {
  it('exports the frozen constants and function surface', () => {
    assert.equal(jwt.AUTH_JWT, 'jwt');
    assert.equal(jwt.TOKEN_TTL_SECONDS, 900);
    assert.equal(jwt.CLOCK_SKEW_SECONDS, 30);
    assert.equal(jwt.RENEW_BEFORE_SECONDS, 60);
    for (const name of [
      'getKeyId',
      'getDeveloperId',
      'getProjectId',
      'getPrivateKeyPath',
      'isJwtConfigured',
      'signToken',
      'getToken',
      'resetCache',
      'getCacheInfo',
    ]) {
      assert.equal(typeof jwt[name], 'function', `${name} must be a function`);
    }
  });
});

describe('qweatherJwt — token construction', () => {
  it('1. mints three Base64URL segments with no padding and decodable JSON', () => {
    const { token } = jwt.signToken({ now: FIXED_NOW });

    assert.equal(typeof token, 'string');
    const parts = token.split('.');
    assert.equal(parts.length, 3, 'exactly three dot separated segments');
    for (const part of parts) {
      assert.ok(part.length > 0, 'no empty segment');
      assert.match(part, /^[A-Za-z0-9_-]+$/, 'segments are Base64URL');
    }
    assert.equal(token.includes('='), false, 'no base64 padding');
    assert.equal(token.includes('+'), false);
    assert.equal(token.includes('/'), false);

    const { header, payload } = decodeToken(token);
    assert.equal(typeof header, 'object');
    assert.equal(typeof payload, 'object');
    // The segments are exactly base64url(JSON) — no extra keys, no whitespace.
    assert.equal(parts[0], Buffer.from(JSON.stringify(header)).toString('base64url'));
    assert.equal(parts[1], Buffer.from(JSON.stringify(payload)).toString('base64url'));
  });

  it('2. header is exactly {"alg":"EdDSA","kid":...} and has no typ', () => {
    const { token } = jwt.signToken({ now: FIXED_NOW });
    const { header } = decodeToken(token);

    assert.deepEqual(Object.keys(header), ['alg', 'kid']);
    assert.equal(header.alg, 'EdDSA');
    assert.equal(header.kid, KID);
    assert.equal('typ' in header, false);
    assert.equal('aud' in header, false);
    assert.deepEqual(header, { alg: 'EdDSA', kid: KID });
  });

  it('3. payload carries iss and sub from the environment', () => {
    const { token } = jwt.signToken({ now: FIXED_NOW });
    const { payload } = decodeToken(token);

    assert.deepEqual(Object.keys(payload), ['iss', 'sub', 'iat', 'exp']);
    assert.equal(payload.iss, ISS);
    assert.equal(payload.sub, SUB);
    assert.equal('aud' in payload, false);
    assert.equal('nbf' in payload, false);
  });

  it('4. iat is floor(now/1000) - 30 and exp is iat + 900', () => {
    const { token, iat, exp } = jwt.signToken({ now: FIXED_NOW });
    const { payload } = decodeToken(token);

    assert.equal(payload.iat, FIXED_NOW_SEC - 30);
    assert.equal(payload.exp, payload.iat + 900);
    assert.equal(payload.exp, payload.iat + jwt.TOKEN_TTL_SECONDS);
    assert.equal(iat, payload.iat);
    assert.equal(exp, payload.exp);

    // Sub-second fractions are floored, not rounded.
    const plus999 = decodeToken(jwt.signToken({ now: FIXED_NOW + 999 }).token).payload;
    assert.equal(plus999.iat, FIXED_NOW_SEC - 30);
    const plus1000 = decodeToken(jwt.signToken({ now: FIXED_NOW + 1000 }).token).payload;
    assert.equal(plus1000.iat, FIXED_NOW_SEC - 29);
  });

  it('5. the Ed25519 signature verifies with the matching public key and fails with another', () => {
    const { token } = jwt.signToken({ now: FIXED_NOW });
    const { parts, signature, payload } = decodeToken(token);

    assert.equal(signature.length, 64, 'Ed25519 signatures are 64 bytes');
    assert.equal(verifyToken(token, primary.publicKey), true);
    assert.equal(verifyToken(token, secondary.publicKey), false, 'a different key must not verify');

    // A modified payload must invalidate the signature.
    const forgedPayload = Buffer.from(JSON.stringify({ ...payload, iss: `${ISS}-forged` })).toString(
      'base64url'
    );
    const forged = `${parts[0]}.${forgedPayload}.${parts[2]}`;
    assert.equal(verifyToken(forged, primary.publicKey), false);
  });
});

describe('qweatherJwt — cache and renewal', () => {
  it('6. signToken() never populates the cache while getToken() caches and reuses', () => {
    jwt.resetCache();

    const first = jwt.signToken({ now: FIXED_NOW });
    assert.deepEqual(Object.keys(first).sort(), ['exp', 'iat', 'token']);
    assert.equal(first.iat, FIXED_NOW_SEC - 30);
    assert.equal(first.exp, first.iat + 900);
    assert.equal(jwt.getCacheInfo().cached, false, 'signToken must not cache');

    const second = jwt.signToken({ now: FIXED_NOW + 5000 });
    assert.notEqual(second.token, first.token);
    assert.equal(second.iat, first.iat + 5);
    assert.equal(jwt.getCacheInfo().cached, false, 'signToken still must not cache');

    const cached1 = jwt.getToken({ now: FIXED_NOW });
    const info = jwt.getCacheInfo();
    assert.equal(info.cached, true);
    assert.equal(info.exp, first.exp);

    // Advancing the clock by 1s while the token is still far from expiry must
    // return the SAME string — a re-sign would have a different iat.
    const cached2 = jwt.getToken({ now: FIXED_NOW + 1000 });
    assert.equal(cached2, cached1, 'cached token is reused');
    assert.equal(jwt.getCacheInfo().exp, first.exp);
  });

  it('7. getToken() re-issues once exp - now < RENEW_BEFORE_SECONDS, with a new iat', () => {
    jwt.resetCache();

    const token1 = jwt.getToken({ now: FIXED_NOW });
    const exp1 = decodeToken(token1).payload.exp;

    // Remaining === 60s is still a reuse (contract: reuse while >= 60).
    const boundaryNow = (exp1 - jwt.RENEW_BEFORE_SECONDS) * 1000;
    assert.equal(jwt.getToken({ now: boundaryNow }), token1, 'exactly 60s left is reused');

    // Remaining === 59s must re-issue.
    const renewNow = (exp1 - jwt.RENEW_BEFORE_SECONDS + 1) * 1000;
    const token2 = jwt.getToken({ now: renewNow });
    assert.notEqual(token2, token1, 'token rotates before expiry');

    const payload2 = decodeToken(token2).payload;
    assert.equal(payload2.iat, Math.floor(renewNow / 1000) - 30);
    assert.equal(payload2.exp, payload2.iat + 900);
    assert.equal(payload2.iss, ISS);
    assert.equal(payload2.sub, SUB);
    assert.equal(jwt.getCacheInfo().exp, payload2.exp);
    assert.equal(jwt.getCacheInfo().cached, true);
    assert.equal(verifyToken(token2, primary.publicKey), true);
  });

  it('8a. resetCache() clears both the cached token and the loaded private key', () => {
    jwt.resetCache();
    jwt.getToken({ now: FIXED_NOW });

    let info = jwt.getCacheInfo();
    assert.equal(info.cached, true);
    assert.equal(info.keyLoaded, true);
    assert.deepEqual(Object.keys(info).sort(), ['cached', 'exp', 'keyLoaded']);
    assert.equal('token' in info, false, 'getCacheInfo never exposes the token');

    jwt.resetCache();
    info = jwt.getCacheInfo();
    assert.equal(info.cached, false);
    assert.equal(info.exp, null);
    assert.equal(info.keyLoaded, false, 'the private key cache is cleared too');
  });

  it('8b. changing QWEATHER_PRIVATE_KEY_PATH loads the new key without resetCache()', () => {
    jwt.resetCache();
    const token1 = jwt.getToken({ now: FIXED_NOW });
    const exp1 = decodeToken(token1).payload.exp;
    assert.equal(verifyToken(token1, primary.publicKey), true);

    process.env.QWEATHER_PRIVATE_KEY_PATH = secondaryPath;

    // Force a renewal (do NOT call resetCache — the path change alone must reload).
    const renewNow = (exp1 - jwt.RENEW_BEFORE_SECONDS + 1) * 1000;
    const token2 = jwt.getToken({ now: renewNow });

    assert.notEqual(token2, token1);
    assert.equal(verifyToken(token2, secondary.publicKey), true, 'new path is used');
    assert.equal(verifyToken(token2, primary.publicKey), false, 'old key is gone');
  });
});

describe('qweatherJwt — configuration', () => {
  it('9. isJwtConfigured() requires kid, iss, sub and the key path to be non-empty', () => {
    assert.equal(jwt.isJwtConfigured(), true, 'full config');

    for (const key of [
      'QWEATHER_KEY_ID',
      'QWEATHER_DEVELOPER_ID',
      'QWEATHER_PROJECT_ID',
      'QWEATHER_PRIVATE_KEY_PATH',
    ]) {
      setJwtEnv({ [key]: undefined });
      assert.equal(jwt.isJwtConfigured(), false, `${key} unset`);

      setJwtEnv({ [key]: '   ' });
      assert.equal(jwt.isJwtConfigured(), false, `${key} blank`);

      setJwtEnv();
      assert.equal(jwt.isJwtConfigured(), true);
    }
  });

  it('9b. the env getters trim their values and return "" when unset', () => {
    process.env.QWEATHER_KEY_ID = `  ${KID}  `;
    process.env.QWEATHER_DEVELOPER_ID = `\t${ISS}\n`;
    process.env.QWEATHER_PROJECT_ID = ` ${SUB}`;
    process.env.QWEATHER_PRIVATE_KEY_PATH = `  ${primaryPath}  `;

    assert.equal(jwt.getKeyId(), KID);
    assert.equal(jwt.getDeveloperId(), ISS);
    assert.equal(jwt.getProjectId(), SUB);
    assert.equal(jwt.getPrivateKeyPath(), primaryPath);

    clearQweatherEnv();
    assert.equal(jwt.getKeyId(), '');
    assert.equal(jwt.getDeveloperId(), '');
    assert.equal(jwt.getProjectId(), '');
    assert.equal(jwt.getPrivateKeyPath(), '');
    assert.equal(jwt.isJwtConfigured(), false);
  });
});

describe('qweatherJwt — errors never leak secrets', () => {
  it('10a. "not configured" carries no kid/iss/sub/key material', () => {
    setJwtEnv({ QWEATHER_PRIVATE_KEY_PATH: undefined });

    for (const sign of [() => jwt.signToken(), () => jwt.getToken()]) {
      assert.throws(sign, (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'QWeather JWT is not configured');
        assertNoSecretLeak(error.message);
        return true;
      });
    }
  });

  it('10b. an unreadable key reports the errno code and never the path', () => {
    const missingPath = path.join(tmpDir, 'definitely-missing-qw-key.pem');
    setJwtEnv({ QWEATHER_PRIVATE_KEY_PATH: missingPath });

    for (const sign of [() => jwt.signToken(), () => jwt.getToken()]) {
      assert.throws(sign, (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /^QWeather JWT private key is not readable( \(ENOENT\))?$/);
        assert.equal(error.message.includes(tmpDir), false, 'must not leak the key path');
        assert.equal(error.message.includes('definitely-missing-qw-key'), false);
        assertNoSecretLeak(error.message);
        return true;
      });
    }
  });

  it('10c. a non-Ed25519 key is rejected without leaking the PEM', () => {
    const rsaPem = rsaPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const rsaPath = writePem('rsa-2048.pem', rsaPem);
    setJwtEnv({ QWEATHER_PRIVATE_KEY_PATH: rsaPath });

    for (const sign of [() => jwt.signToken(), () => jwt.getToken()]) {
      assert.throws(sign, (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'QWeather JWT private key is not an Ed25519 key');
        assertNoSecretLeak(error.message);
        return true;
      });
    }
  });

  it('10d. an unparsable PEM is reported as invalid without echoing its content', () => {
    const brokenPath = writePem('broken.pem', 'this is not a private key at all\n');
    setJwtEnv({ QWEATHER_PRIVATE_KEY_PATH: brokenPath });

    for (const sign of [() => jwt.signToken(), () => jwt.getToken()]) {
      assert.throws(sign, (error) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'QWeather JWT private key is invalid');
        assert.equal(error.message.includes('this is not a private key at all'), false);
        assertNoSecretLeak(error.message);
        return true;
      });
    }
  });
});

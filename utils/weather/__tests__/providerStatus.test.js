'use strict';

/**
 * `utils/weather/index.js` — getProviderStatus() shape / non-disclosure.
 *
 * Source of truth: build-logs/qweather-jwt-contract.md (FROZEN) — item 19.
 *
 * The registry module loads `models/Weather` (sequelize/sqlite) and
 * `utils/loadConfig` (reads data/config.json) at require time. Both are stubbed
 * in the CommonJS require cache so this test stays hermetic: no database, no
 * data/ directory, no repository side effects.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

const repoRoot = path.join(__dirname, '..', '..', '..');
const KID = 'status-test-credential-id';
const ISS = 'status-test-developer-id';
const SUB = 'status-test-project-id';
const API_KEY = 'status-test-api-key-abcdef';
const HOST = 'status-test-host.xy.qweatherapi.com';

let currentConfig = { weatherProvider: 'qweather' };
let envSnapshot = {};
let tmpDir = '';
let keyPath = '';

// ---------------------------------------------------------------------------
// Stub the two heavyweight dependencies BEFORE loading the registry.
// ---------------------------------------------------------------------------
const loadConfigPath = require.resolve(path.join(repoRoot, 'utils', 'loadConfig.js'));
const weatherModelPath = require.resolve(path.join(repoRoot, 'models', 'Weather.js'));

const cacheEntry = (filename, exports) => ({
  id: filename,
  filename,
  loaded: true,
  exports,
  children: [],
  paths: [path.dirname(filename)],
});

require.cache[loadConfigPath] = cacheEntry(loadConfigPath, async () => ({ ...currentConfig }));
require.cache[weatherModelPath] = cacheEntry(weatherModelPath, {
  create: async (payload) => payload,
});

const weatherIndex = require(path.join(repoRoot, 'utils', 'weather', 'index.js'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

const configureJwt = () => {
  process.env.QWEATHER_AUTH_MODE = 'jwt';
  process.env.QWEATHER_KEY_ID = KID;
  process.env.QWEATHER_DEVELOPER_ID = ISS;
  process.env.QWEATHER_PROJECT_ID = SUB;
  process.env.QWEATHER_PRIVATE_KEY_PATH = keyPath;
};

const collectKeys = (value, out = []) => {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      out.push(key);
      collectKeys(nested, out);
    }
  }
  return out;
};

const CREDENTIALISH_KEY = /host|kid|iss\b|sub\b|project|jwt|private|secret|api[-_]?key|token|credential/i;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qw-status-'));
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  keyPath = path.join(tmpDir, 'status-ed25519.pem');
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.chmodSync(keyPath, 0o600);
});

after(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  snapshotEnv();
  clearQweatherEnv();
  currentConfig = { weatherProvider: 'qweather' };
});

afterEach(() => {
  restoreEnv();
});

describe('getProviderStatus()', () => {
  it('19. returns exactly the documented shape with jwt configured', async () => {
    process.env.QWEATHER_API_HOST = HOST;
    configureJwt();
    process.env.QWEATHER_API_KEY = API_KEY;
    currentConfig = { weatherProvider: 'qweather', WEATHER_API_KEY: 'weatherapi-config-secret' };

    const status = await weatherIndex.getProviderStatus();

    assert.deepEqual(Object.keys(status).sort(), [
      'authMode',
      'configured',
      'provider',
      'qweather',
      'weatherapi',
    ]);
    assert.equal(status.provider, 'qweather');
    assert.equal(status.configured, true);
    assert.equal(status.authMode, 'jwt');
    assert.deepEqual(Object.keys(status.qweather).sort(), ['authMode', 'configured']);
    assert.equal(status.qweather.configured, true);
    assert.equal(status.qweather.authMode, 'jwt');
    assert.deepEqual(Object.keys(status.weatherapi).sort(), ['configured']);
    assert.equal(status.weatherapi.configured, true);
  });

  it('19b. deep scan: no host key and no credential-ish key anywhere', async () => {
    process.env.QWEATHER_API_HOST = HOST;
    configureJwt();
    process.env.QWEATHER_API_KEY = API_KEY;
    currentConfig = { weatherProvider: 'qweather', WEATHER_API_KEY: 'weatherapi-config-secret' };

    const status = await weatherIndex.getProviderStatus();
    const keys = collectKeys(status);

    assert.equal(keys.includes('host'), false, 'host is gone from the status payload');
    for (const key of keys) {
      assert.doesNotMatch(key, CREDENTIALISH_KEY, `credential-ish key leaked: ${key}`);
    }

    // And no credential value is echoed either.
    const json = JSON.stringify(status);
    assert.equal(json.includes('"host"'), false);
    for (const secret of [
      HOST,
      API_KEY,
      KID,
      ISS,
      SUB,
      keyPath,
      'weatherapi-config-secret',
    ]) {
      assert.equal(json.includes(secret), false, 'status payload must not echo secrets');
    }
  });

  it('19c. api-key mode and unset mode report the effective auth mode', async () => {
    process.env.QWEATHER_API_HOST = HOST;
    process.env.QWEATHER_AUTH_MODE = 'api-key';
    process.env.QWEATHER_API_KEY = API_KEY;

    let status = await weatherIndex.getProviderStatus();
    assert.equal(status.provider, 'qweather');
    assert.equal(status.qweather.authMode, 'api-key');
    assert.equal(status.authMode, 'api-key');
    assert.equal(status.configured, true);

    clearQweatherEnv();
    status = await weatherIndex.getProviderStatus();
    assert.equal(status.qweather.configured, false);
    assert.equal(status.qweather.authMode, null);
    assert.equal(status.authMode, null);
    assert.equal(status.configured, false);
  });

  it('19d. weatherapi selected still exposes the same non-secret shape', async () => {
    currentConfig = { weatherProvider: 'weatherapi', WEATHER_API_KEY: 'weatherapi-config-secret' };
    process.env.QWEATHER_API_HOST = HOST;
    configureJwt();

    const status = await weatherIndex.getProviderStatus();

    assert.equal(status.provider, 'weatherapi');
    assert.equal(status.weatherapi.configured, true);
    assert.equal(status.authMode, null, 'weatherapi has no auth mode');
    assert.deepEqual(Object.keys(status.qweather).sort(), ['authMode', 'configured']);
    assert.equal(status.qweather.authMode, 'jwt');
    assert.equal(collectKeys(status).includes('host'), false);
  });
});

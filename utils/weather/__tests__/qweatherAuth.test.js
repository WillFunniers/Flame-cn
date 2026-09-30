'use strict';

/**
 * Auth selection + strict host validation for `utils/weather/qweather.js`.
 *
 * Source of truth: build-logs/qweather-jwt-contract.md (FROZEN) — items 11..18.
 *
 * Hermetic: a real Ed25519 keypair is generated in-process and written to a
 * fresh temp dir; the axios module is never called here (only header building
 * and host parsing are exercised). process.env is snapshotted/restored per test.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const qweather = require('../qweather');
const qweatherJwt = require('../qweatherJwt');

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

const KID = 'auth-test-credential-id';
const ISS = 'auth-test-developer-id';
const SUB = 'auth-test-project-id';
const API_KEY = 'auth-test-api-key-0123456789';
const HOST = 'dedicated-test-host.xy.qweatherapi.com';
const RETIRED_HOSTS = ['api.qweather.com', 'devapi.qweather.com', 'geoapi.qweather.com'];

let envSnapshot = {};
let tmpDir = '';
let keyPath = '';

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

const configureApiKey = () => {
  process.env.QWEATHER_AUTH_MODE = 'api-key';
  process.env.QWEATHER_API_KEY = API_KEY;
};

const decodeHeader = (token) =>
  JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qw-auth-'));
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  keyPath = path.join(tmpDir, 'auth-ed25519.pem');
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.chmodSync(keyPath, 0o600);
});

after(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  snapshotEnv();
  clearQweatherEnv();
  qweatherJwt.resetCache();
});

afterEach(() => {
  qweatherJwt.resetCache();
  restoreEnv();
});

describe('qweather — module surface', () => {
  it('exports the frozen names and no longer exports getJwt', () => {
    assert.equal(qweather.NAME, 'qweather');
    assert.equal(qweather.AUTH_API_KEY, 'api-key');
    assert.equal(qweather.AUTH_JWT, 'jwt');
    for (const name of ['isConfigured', 'fetchWeather', 'getHost', 'getAuthMode', 'buildAuthHeaders']) {
      assert.equal(typeof qweather[name], 'function', `${name} must be a function`);
    }
    assert.equal(qweather.getJwt, undefined, 'getJwt is removed by the contract');
    assert.equal(qweather.getAuthHeaders === undefined || typeof qweather.getAuthHeaders === 'function', true);
  });
});

describe('qweather — auth mode selection', () => {
  it('11. mode=jwt sends exactly one Authorization: Bearer <minted JWT> header', () => {
    configureJwt();
    process.env.QWEATHER_API_HOST = HOST;

    const headers = qweather.buildAuthHeaders();
    assert.deepEqual(Object.keys(headers), ['Authorization']);
    assert.equal('X-QW-Api-Key' in headers, false);
    assert.match(headers.Authorization, /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(/=/.test(headers.Authorization), false, 'no padding in the token');

    const token = headers.Authorization.slice('Bearer '.length);
    const header = decodeHeader(token);
    assert.equal(header.alg, 'EdDSA');
    assert.equal(header.kid, KID);
    assert.equal(token, qweatherJwt.getToken(), 'the header carries the runtime-minted token');

    assert.equal(qweather.getAuthMode(), 'jwt');
    assert.equal(qweather.isConfigured(), true);
  });

  it('11b. the removed static QWEATHER_JWT env var is ignored', () => {
    configureJwt();
    process.env.QWEATHER_JWT = 'c3RhdGlj.andvbGQ.signature';

    const headers = qweather.buildAuthHeaders();
    const token = headers.Authorization.slice('Bearer '.length);
    assert.equal(decodeHeader(token).kid, KID, 'the token is minted, not read from QWEATHER_JWT');
    assert.equal(token.includes('c3RhdGlj'), false);

    clearQweatherEnv();
    process.env.QWEATHER_JWT = 'c3RhdGlj.andvbGQ.signature';
    process.env.QWEATHER_API_HOST = HOST;
    assert.equal(qweather.getAuthMode(), null, 'QWEATHER_JWT alone never configures the provider');
    assert.equal(qweather.isConfigured(), false);
  });

  it('12. mode=api-key sends exactly one X-QW-Api-Key header', () => {
    configureApiKey();
    process.env.QWEATHER_API_HOST = HOST;

    const headers = qweather.buildAuthHeaders();
    assert.deepEqual(headers, { 'X-QW-Api-Key': API_KEY });
    assert.equal('Authorization' in headers, false);
    assert.equal(qweather.getAuthMode(), 'api-key');
    assert.equal(qweather.isConfigured(), true);
  });

  it('13. with both credentials configured the headers never contain both', () => {
    // jwt selected
    configureJwt();
    process.env.QWEATHER_API_KEY = API_KEY;
    process.env.QWEATHER_API_HOST = HOST;

    let headers = qweather.buildAuthHeaders();
    assert.deepEqual(Object.keys(headers), ['Authorization']);
    assert.equal('X-QW-Api-Key' in headers, false);

    // api-key selected
    configureApiKey();
    headers = qweather.buildAuthHeaders();
    assert.deepEqual(Object.keys(headers), ['X-QW-Api-Key']);
    assert.equal('Authorization' in headers, false);

    // never both, in any mode
    for (const mode of ['jwt', 'api-key', 'bogus', undefined]) {
      clearQweatherEnv();
      process.env.QWEATHER_API_HOST = HOST;
      process.env.QWEATHER_KEY_ID = KID;
      process.env.QWEATHER_DEVELOPER_ID = ISS;
      process.env.QWEATHER_PROJECT_ID = SUB;
      process.env.QWEATHER_PRIVATE_KEY_PATH = keyPath;
      process.env.QWEATHER_API_KEY = API_KEY;
      if (mode !== undefined) process.env.QWEATHER_AUTH_MODE = mode;

      const built = qweather.buildAuthHeaders();
      const keys = Object.keys(built);
      assert.ok(keys.length <= 1, `at most one credential header for mode=${mode}`);
      assert.equal(
        'Authorization' in built && 'X-QW-Api-Key' in built,
        false,
        `both credentials for mode=${mode}`
      );
    }
  });

  it('14. unset or unknown QWEATHER_AUTH_MODE means not configured', () => {
    process.env.QWEATHER_API_HOST = HOST;
    process.env.QWEATHER_API_KEY = API_KEY;
    process.env.QWEATHER_KEY_ID = KID;
    process.env.QWEATHER_DEVELOPER_ID = ISS;
    process.env.QWEATHER_PROJECT_ID = SUB;
    process.env.QWEATHER_PRIVATE_KEY_PATH = keyPath;

    for (const mode of [undefined, '', '   ', 'bearer', 'oauth', 'API_KEY', 'jwt,api-key']) {
      if (mode === undefined) delete process.env.QWEATHER_AUTH_MODE;
      else process.env.QWEATHER_AUTH_MODE = mode;

      assert.equal(qweather.getAuthMode(), null, `mode=${JSON.stringify(mode)}`);
      assert.equal(qweather.isConfigured(), false, `mode=${JSON.stringify(mode)}`);
      assert.deepEqual(qweather.buildAuthHeaders(), {});
    }

    // Mode is case-insensitive per the contract.
    process.env.QWEATHER_AUTH_MODE = 'JWT';
    assert.equal(qweather.getAuthMode(), 'jwt');
    process.env.QWEATHER_AUTH_MODE = 'Api-Key';
    assert.equal(qweather.getAuthMode(), 'api-key');
  });

  it('14b. an explicitly selected mode still needs its own credentials', () => {
    process.env.QWEATHER_API_HOST = HOST;

    process.env.QWEATHER_AUTH_MODE = 'jwt';
    process.env.QWEATHER_KEY_ID = KID;
    process.env.QWEATHER_DEVELOPER_ID = ISS;
    process.env.QWEATHER_PROJECT_ID = SUB;
    delete process.env.QWEATHER_PRIVATE_KEY_PATH;
    assert.equal(qweather.getAuthMode(), null, 'jwt needs the key path');

    clearQweatherEnv();
    process.env.QWEATHER_API_HOST = HOST;
    process.env.QWEATHER_AUTH_MODE = 'api-key';
    assert.equal(qweather.getAuthMode(), null, 'api-key needs the key');
    process.env.QWEATHER_API_KEY = '   ';
    assert.equal(qweather.getAuthMode(), null, 'blank api key is not a credential');
  });

  it('14c. isConfigured() is host AND auth mode', () => {
    configureJwt();
    process.env.QWEATHER_API_HOST = HOST;
    assert.equal(qweather.isConfigured(), true);

    delete process.env.QWEATHER_API_HOST;
    assert.equal(qweather.isConfigured(), false, 'no host');

    process.env.QWEATHER_API_HOST = HOST;
    process.env.QWEATHER_AUTH_MODE = 'bogus';
    assert.equal(qweather.isConfigured(), false, 'no valid auth mode');
  });
});

describe('qweather — getHost() strict validation', () => {
  it('15. accepts a dedicated host, strips the scheme and lowercases it', () => {
    const accepted = [
      ['abcxyz.xy.qweatherapi.com', 'abcxyz.xy.qweatherapi.com'],
      ['ABCxyz.XY.qweatherapi.com', 'abcxyz.xy.qweatherapi.com'],
      ['https://ABCxyz.XY.qweatherapi.com', 'abcxyz.xy.qweatherapi.com'],
      ['HTTPS://abc.xy.qweatherapi.com', 'abc.xy.qweatherapi.com'],
      ['http://abc.xy.qweatherapi.com', 'abc.xy.qweatherapi.com'],
      ['  abc.xy.qweatherapi.com  ', 'abc.xy.qweatherapi.com'],
      ['abc.xy.qweatherapi.com:443', 'abc.xy.qweatherapi.com:443'],
      ['https://ABC.xy.qweatherapi.com:8443', 'abc.xy.qweatherapi.com:8443'],
      ['localhost', 'localhost'],
    ];

    for (const [input, expected] of accepted) {
      process.env.QWEATHER_API_HOST = input;
      assert.equal(qweather.getHost(), expected, `input=${JSON.stringify(input)}`);
    }
  });

  it('16. rejects paths, queries, fragments, whitespace and a bare scheme', () => {
    const rejected = [
      'abc.xy.qweatherapi.com/weather',
      'abc.xy.qweatherapi.com/',
      'https://abc.xy.qweatherapi.com/weather/v1',
      'abc.xy.qweatherapi.com?x=1',
      'abc.xy.qweatherapi.com#frag',
      'abc xy.qweatherapi.com',
      'abc\txy.qweatherapi.com',
      'https://',
      'http://',
      '//abc.xy.qweatherapi.com',
      'abc_xy.qweatherapi.com',
      '.abc.xy.qweatherapi.com',
      'abc.xy.qweatherapi.com.',
      'abc.xy.qweatherapi.com:123456',
      'abc.xy.qweatherapi.com:80x',
      '-abc.xy.qweatherapi.com',
    ];

    for (const input of rejected) {
      process.env.QWEATHER_API_HOST = input;
      assert.equal(qweather.getHost(), '', `input=${JSON.stringify(input)}`);
    }
  });

  it('17. refuses the three retired public hosts (with scheme, case or port)', () => {
    for (const retired of RETIRED_HOSTS) {
      for (const input of [
        retired,
        retired.toUpperCase(),
        `https://${retired}`,
        `http://${retired}`,
        `${retired}:443`,
      ]) {
        process.env.QWEATHER_API_HOST = input;
        assert.equal(qweather.getHost(), '', `input=${JSON.stringify(input)}`);
      }
    }
  });

  it('18. unset, empty or blank host is an empty string', () => {
    delete process.env.QWEATHER_API_HOST;
    assert.equal(qweather.getHost(), '');
    process.env.QWEATHER_API_HOST = '';
    assert.equal(qweather.getHost(), '');
    process.env.QWEATHER_API_HOST = '     ';
    assert.equal(qweather.getHost(), '');
    process.env.QWEATHER_API_HOST = 'https://';
    assert.equal(qweather.getHost(), '');
  });
});

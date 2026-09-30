'use strict';

/**
 * Transport-failure HOST leak regression (fourth verifier defect).
 *
 * When `QWEATHER_API_HOST` carries a port, a real DNS failure
 * (`getaddrinfo ENOTFOUND <bare hostname>`) mentions only the PORT-STRIPPED
 * hostname, so a scrubber built from the full `host:port` string misses it and
 * the host reaches `err.message`, `err.stack[0]` and — through the real
 * `errorHandler` — the HTTP response body. Node DNS/socket errors also carry
 * own `hostname` / `host` / `address` / `port` properties that a
 * `console.log(err)` prints verbatim.
 *
 * Hermetic: `axios` is replaced in the require cache (no DNS, no network) and
 * `utils/Logger` / `utils/ErrorResponse` are stubbed so the real
 * `middleware/errorHandler.js` can be loaded without side effects. The Ed25519
 * key is generated in-process into a mode-0600 temp dir, removed in `after`,
 * and `process.env` is snapshotted/restored around every test.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const util = require('node:util');

const repoRoot = path.join(__dirname, '..', '..', '..');

const cacheEntry = (filename, exports) => ({
  id: filename,
  filename,
  loaded: true,
  exports,
  children: [],
  paths: [path.dirname(filename)],
});

// ---------------------------------------------------------------------------
// Stub axios + the errorHandler dependencies BEFORE loading anything.
// ---------------------------------------------------------------------------
const axiosPath = require.resolve('axios');
const axiosStub = {
  get: async () => {
    throw new Error('axios stub was not configured for this test');
  },
};
require.cache[axiosPath] = cacheEntry(axiosPath, axiosStub);

const loggerPath = require.resolve(path.join(repoRoot, 'utils', 'Logger.js'));
const errorResponsePath = require.resolve(path.join(repoRoot, 'utils', 'ErrorResponse.js'));
require.cache[loggerPath] = cacheEntry(loggerPath, class SilentLogger { log() {} });
require.cache[errorResponsePath] = cacheEntry(
  errorResponsePath,
  class ErrorResponse extends Error {}
);

const qweather = require('../qweather');
const errorHandler = require(path.join(repoRoot, 'middleware', 'errorHandler.js'));

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

const HOSTNAME = 'nope-abc123.qweatherapi.com';
const HOST_PORT = `${HOSTNAME}:8080`;
const API_KEY = 'host-leak-api-key-24680';
const KID = 'host-leak-credential-id';
const ISS = 'host-leak-developer-id';
const SUB = 'host-leak-project-id';
const CONFIG = { lat: '39.9', long: '116.4' };
const URL_PATH = '/weather/v1/current/39.9/116.4';

let envSnapshot = {};
let tmpDir = '';
let keyPath = '';
let calls = [];

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

const setup = (mode, host) => {
  clearQweatherEnv();
  process.env.QWEATHER_API_HOST = host;

  if (mode === 'jwt') {
    process.env.QWEATHER_AUTH_MODE = 'jwt';
    process.env.QWEATHER_KEY_ID = KID;
    process.env.QWEATHER_DEVELOPER_ID = ISS;
    process.env.QWEATHER_PROJECT_ID = SUB;
    process.env.QWEATHER_PRIVATE_KEY_PATH = keyPath;
  } else {
    process.env.QWEATHER_AUTH_MODE = 'api-key';
    process.env.QWEATHER_API_KEY = API_KEY;
  }
};

/** Builds the shape of a real axios DNS/socket transport error. */
const makeDnsError = (url, options, { message, hostname }) => {
  const error = new Error(message);
  error.code = 'ENOTFOUND';
  error.errno = -3008;
  error.syscall = 'getaddrinfo';
  error.hostname = hostname; // Node DNS errors carry this as an own property
  error.host = hostname; // Node socket errors too
  error.address = '203.0.113.7';
  error.port = 8080;
  error.response = undefined;
  error.isAxiosError = true;
  error.config = {
    url,
    method: 'get',
    timeout: 8000,
    headers: {
      ...options.headers,
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'axios/0.24.0',
    },
  };
  error.request = { _header: `GET ${URL_PATH} HTTP/1.1`, socket: {} };
  error.toJSON = function toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      hostname: this.hostname,
      config: this.config,
    };
  };
  return error;
};

const failDns = ({ message, hostname = HOSTNAME } = {}) => {
  axiosStub.get = async (url, options) => {
    calls.push({ url, options });
    throw makeDnsError(url, options, {
      message: message || `getaddrinfo ENOTFOUND ${hostname}`,
      hostname,
    });
  };
};

const failHttp = (status, data) => {
  axiosStub.get = async (url, options) => {
    calls.push({ url, options });
    const error = new Error(`Request failed with status code ${status}`);
    error.isAxiosError = true;
    error.config = { url, method: 'get', headers: { ...options.headers } };
    error.response = { status, data, headers: {} };
    throw error;
  };
};

/** The exact credential that went on the wire for this call. */
const sentCredential = () => {
  const headers = calls[0].options.headers;
  return headers.Authorization || headers['X-QW-Api-Key'];
};

const captureRejection = async () => {
  try {
    await qweather.fetchWeather(CONFIG);
  } catch (error) {
    return error;
  }
  throw new Error('expected fetchWeather() to reject');
};

const makeRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const assertNoHostLeak = (value, forbidden, label) => {
  const text = String(value);
  const names = ['bare hostname', 'host:port', 'credential', 'JWT/API key'];
  forbidden.forEach((needle, index) => {
    assert.equal(
      text.includes(needle),
      false,
      `${label} must not contain the ${names[index] || 'secret'}`
    );
  });
};

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qw-hostleak-'));
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  keyPath = path.join(tmpDir, 'hostleak-ed25519.pem');
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.chmodSync(keyPath, 0o600);
});

after(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  snapshotEnv();
  clearQweatherEnv();
  calls = [];
});

afterEach(() => {
  restoreEnv();
});

describe('transport failure — host with a port (fourth defect)', () => {
  it('1. scrubs the bare hostname from message and stack when the host has a port', async () => {
    setup('jwt', HOST_PORT);
    failDns();

    const error = await captureRejection();

    assert.equal(error.message, 'getaddrinfo ENOTFOUND [redacted-host]');
    assert.equal(error.message.includes(HOSTNAME), false);
    assert.equal(error.message.includes(HOST_PORT), false);

    const stack = String(error.stack);
    assert.equal(stack.includes(HOSTNAME), false, 'stack must not contain the bare hostname');
    assert.equal(stack.includes(HOST_PORT), false, 'stack must not contain host:port');
    assert.ok(stack.includes('[redacted-host]'), 'stack shows the scrub marker');
  });

  it('2. scrubs the hostname when the host has no port', async () => {
    setup('jwt', HOSTNAME);
    failDns();

    const error = await captureRejection();

    assert.equal(error.message, 'getaddrinfo ENOTFOUND [redacted-host]');
    assert.equal(error.message.includes(HOSTNAME), false);
    assert.equal(String(error.stack).includes(HOSTNAME), false, 'stack must not contain the host');
    assert.ok(String(error.stack).includes('[redacted-host]'));
  });

  it('3. removes hostname/host/address/port/config/request/response from the error', async () => {
    setup('jwt', HOST_PORT);
    failDns();

    const error = await captureRejection();

    for (const key of ['hostname', 'host', 'address', 'port', 'config', 'request', 'response']) {
      assert.equal(key in error, false, `${key} must be removed from the rethrown error`);
      assert.equal(error[key], undefined, `${key} must not be readable`);
    }
  });

  it('4. never serialises the host, port or credential (jwt mode)', async () => {
    setup('jwt', HOST_PORT);
    failDns();

    const error = await captureRejection();
    const credential = sentCredential();
    const forbidden = [HOSTNAME, HOST_PORT, credential, credential.replace(/^Bearer /, '')];

    assertNoHostLeak(util.inspect(error, { depth: 10, showHidden: true }), forbidden, 'util.inspect');
    assertNoHostLeak(JSON.stringify(error), forbidden, 'JSON.stringify');
    assertNoHostLeak(
      JSON.stringify(error, Object.getOwnPropertyNames(error)),
      forbidden,
      'JSON.stringify(own names)'
    );
    assertNoHostLeak(JSON.stringify(Object.entries(error)), forbidden, 'Object.entries');
    assertNoHostLeak(String(error), forbidden, 'String(error)');
    assertNoHostLeak(String(error.stack), forbidden, 'String(error.stack)');

    if (typeof error.toJSON === 'function') {
      const viaToJSON = error.toJSON();
      assertNoHostLeak(util.inspect(viaToJSON, { depth: 10, showHidden: true }), forbidden, 'toJSON inspect');
      assertNoHostLeak(JSON.stringify(viaToJSON), forbidden, 'toJSON stringify');
    }
  });

  it('5. gives the api-key mode the same host/credential treatment', async () => {
    setup('api-key', HOST_PORT);
    failDns();

    const error = await captureRejection();
    const credential = sentCredential();
    assert.equal(credential, API_KEY);

    for (const key of ['hostname', 'host', 'address', 'port', 'config', 'request', 'response']) {
      assert.equal(key in error, false, `${key} must be removed`);
    }

    const forbidden = [HOSTNAME, HOST_PORT, API_KEY];
    assertNoHostLeak(util.inspect(error, { depth: 10, showHidden: true }), forbidden, 'api-key inspect');
    assertNoHostLeak(JSON.stringify(error), forbidden, 'api-key JSON.stringify');
    assertNoHostLeak(String(error.stack), forbidden, 'api-key stack');
  });

  for (const mode of ['jwt', 'api-key']) {
    it(`6. the real errorHandler returns a ${mode}-mode response body with no host`, async () => {
      setup(mode, HOST_PORT);
      failDns();

      const rejected = await captureRejection();
      const credential = sentCredential();

      const res = makeRes();
      const logged = [];
      const originalLog = console.log;
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development'; // the repo's tracked .env value
      console.log = (...args) => logged.push(util.inspect(args, { depth: 10, showHidden: true }));

      try {
        errorHandler(rejected, {}, res, () => {});
      } finally {
        console.log = originalLog;
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }

      assert.equal(res.statusCode, 500, 'a transport failure is not an upstream status');
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /ENOTFOUND/);

      const body = JSON.stringify(res.body);
      assert.equal(body.includes(HOSTNAME), false, 'response body must not contain the hostname');
      assert.equal(body.includes(HOST_PORT), false, 'response body must not contain host:port');
      assert.equal(body.includes(credential), false, 'response body must not contain the credential');

      assert.ok(logged.length > 0, 'the NODE_ENV=development branch really logged');
      const devLog = logged.join('\n');
      assert.equal(devLog.includes(HOSTNAME), false, 'dev log must not contain the hostname');
      assert.equal(devLog.includes(HOST_PORT), false, 'dev log must not contain host:port');
      assert.equal(devLog.includes(credential), false, 'dev log must not contain the credential');
    });
  }

  it('7a. does not treat the bare port or unrelated short text as a host needle', async () => {
    setup('jwt', HOST_PORT);
    failDns({ message: 'socket hang up after 8080 ms while parsing JSON' });

    const error = await captureRejection();

    assert.equal(
      error.message,
      'socket hang up after 8080 ms while parsing JSON',
      'the port alone / short text must not be mangled'
    );
    assert.equal(error.message.includes('[redacted-host]'), false);
  });

  it('7b. still redacts the host:port in the 127.0.0.1:9 ECONNREFUSED case', async () => {
    setup('jwt', '127.0.0.1:9');
    failDns({ message: 'connect ECONNREFUSED 127.0.0.1:9', hostname: '127.0.0.1' });

    const error = await captureRejection();

    assert.equal(error.message, 'connect ECONNREFUSED [redacted-host]');
    assert.equal(error.message.includes('127.0.0.1'), false);
    assert.equal(String(error.stack).includes('127.0.0.1'), false);
    assert.ok(String(error.stack).includes('[redacted-host]'));
  });

  it('8. leaves the HTTP-error path intact and redacted', async () => {
    const jwtish = 'eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkZXYifQ.c2lnbmF0dXJl';

    for (const status of [400, 401, 403, 429, 500]) {
      setup('api-key', HOST_PORT);
      failHttp(status, {
        code: String(status),
        status,
        type: `https://upstream.test/errors/${status}`,
        title: 'Upstream Title',
        detail: `Bearer ${jwtish} key=${API_KEY}`,
        invalidParams: [API_KEY, jwtish],
      });

      const error = await captureRejection();

      assert.equal(error.statusCode, status);
      assert.deepEqual(Object.keys(error.qweather).sort(), [
        'detail',
        'invalidParams',
        'status',
        'title',
        'type',
      ]);
      assert.equal(error.qweather.status, status);
      const blob = `${error.message}\n${JSON.stringify(error.qweather)}`;
      assert.equal(blob.includes(API_KEY), false, `HTTP ${status}: API key leaked`);
      assert.equal(blob.includes('eyJhbGci'), false, `HTTP ${status}: JWT leaked`);
      assert.equal(error.config, undefined, `HTTP ${status}: config must be gone`);
    }
  });
});

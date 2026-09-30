'use strict';

/**
 * `utils/weather/qweather.js` — fetchWeather() mapping + upstream error handling.
 *
 * Source of truth: build-logs/qweather-jwt-contract.md (FROZEN) — items 20..22
 * (plus item 11's "single credential" rule at the request level).
 *
 * Hermetic: the `axios` module is replaced in the CommonJS require cache before
 * qweather.js is loaded, so no network call is ever made. No real credentials:
 * the API key is a test literal and the JWT private key is generated in-process
 * inside a temp dir.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const util = require('node:util');

// ---------------------------------------------------------------------------
// Replace axios BEFORE loading the provider under test.
// ---------------------------------------------------------------------------
const axiosPath = require.resolve('axios');
const axiosStub = {
  get: async () => {
    throw new Error('axios stub was not configured for this test');
  },
};
require.cache[axiosPath] = {
  id: axiosPath,
  filename: axiosPath,
  loaded: true,
  exports: axiosStub,
  children: [],
  paths: [path.dirname(axiosPath)],
};

const qweather = require('../qweather');

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

const HOST = 'fetch-test-host.xy.qweatherapi.com';
const API_KEY = 'fetch-test-api-key-987654321';
const KID = 'fetch-test-credential-id';
const ISS = 'fetch-test-developer-id';
const SUB = 'fetch-test-project-id';
const CONFIG = { lat: '39.9', long: '116.4' };
const WEATHER_MODEL_KEYS = [
  'cloud',
  'conditionCode',
  'conditionText',
  'externalLastUpdate',
  'humidity',
  'isDay',
  'tempC',
  'tempF',
  'windK',
  'windM',
];

let envSnapshot = {};
let calls = [];
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

const configureApiKey = () => {
  process.env.QWEATHER_API_HOST = HOST;
  process.env.QWEATHER_AUTH_MODE = 'api-key';
  process.env.QWEATHER_API_KEY = API_KEY;
};

/** Simulate a 2xx axios response. */
const respond = (status, data) => {
  axiosStub.get = async (url, options) => {
    calls.push({ url, options });
    return { status, data, headers: {} };
  };
};

/** Simulate an axios rejection for a non-2xx upstream response. */
const fail = (status, data) => {
  axiosStub.get = async (url, options) => {
    calls.push({ url, options });
    const error = new Error(`Request failed with status code ${status}`);
    error.isAxiosError = true;
    error.code = 'ERR_BAD_RESPONSE';
    error.response = { status, data, headers: {} };
    throw error;
  };
};

const qweatherErrorBody = (status, overrides = {}) => ({
  code: String(status),
  status,
  type: `https://upstream.test/errors/${status}`,
  title: 'Upstream Title',
  detail: 'upstream detail',
  invalidParams: ['lat invalid'],
  ...overrides,
});

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qw-fetch-'));
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  keyPath = path.join(tmpDir, 'fetch-ed25519.pem');
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.chmodSync(keyPath, 0o600);
});

after(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  snapshotEnv();
  clearQweatherEnv();
  configureApiKey();
  calls = [];
});

afterEach(() => {
  restoreEnv();
});

describe('fetchWeather() — upstream error preservation (item 20)', () => {
  for (const status of [400, 401, 403, 429, 500]) {
    it(`preserves status/type/title/detail/invalidParams for HTTP ${status}`, async () => {
      const body = qweatherErrorBody(status);
      fail(status, body);

      await assert.rejects(
        () => qweather.fetchWeather(CONFIG),
        (error) => {
          assert.ok(error instanceof Error);
          assert.equal(error.statusCode, status);
          assert.ok(error.qweather, 'err.qweather is present');
          assert.deepEqual(Object.keys(error.qweather).sort(), [
            'detail',
            'invalidParams',
            'status',
            'title',
            'type',
          ]);
          assert.equal(error.qweather.status, status);
          assert.equal(error.qweather.type, body.type);
          assert.equal(error.qweather.title, body.title);
          assert.equal(error.qweather.detail, body.detail);
          assert.deepEqual(error.qweather.invalidParams, ['lat invalid']);
          assert.equal(
            error.message,
            `QWeather upstream error (HTTP ${status} ${body.title}): ${body.detail}`
          );
          return true;
        }
      );
    });
  }

  it('treats a 2xx body with code !== "200" as an error and keeps err.statusCode', async () => {
    respond(200, { code: '400', type: 'upstream type', title: 'Bad Request', detail: 'bad params' });

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.ok(error.qweather);
        assert.equal(error.qweather.title, 'Bad Request');
        assert.equal(error.qweather.detail, 'bad params');
        return true;
      }
    );
  });

  it('omits the title and falls back to "request failed" when upstream omits them', async () => {
    fail(500, { code: '500' });

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.equal(error.statusCode, 500);
        assert.equal(error.message, 'QWeather upstream error (HTTP 500): request failed');
        assert.equal(error.qweather.status, 500);
        assert.ok(!error.qweather.title, 'missing title stays falsy');
        assert.ok(!error.qweather.detail, 'missing detail stays falsy');
        assert.ok(Array.isArray(error.qweather.invalidParams));
        return true;
      }
    );
  });

  it('caps invalidParams at 20 redacted strings', async () => {
    const body = qweatherErrorBody(400, {
      invalidParams: Array.from({ length: 25 }, (_, index) => `param-${index}`),
    });
    fail(400, body);

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.ok(Array.isArray(error.qweather.invalidParams));
        assert.equal(error.qweather.invalidParams.length, 20);
        assert.ok(error.qweather.invalidParams.every((entry) => typeof entry === 'string'));
        assert.equal(error.qweather.invalidParams[0], 'param-0');
        return true;
      }
    );
  });

  it('leaves plain string invalidParams entries unchanged', async () => {
    fail(400, qweatherErrorBody(400, { invalidParams: ['longitude', 'latitude'] }));

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.deepEqual(error.qweather.invalidParams, ['longitude', 'latitude']);
        return true;
      }
    );
  });

  it('flattens object invalidParams entries instead of "[object Object]"', async () => {
    fail(
      400,
      qweatherErrorBody(400, {
        invalidParams: [{ param: 'latitude', value: '113.034', message: 'out of range' }],
      })
    );

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.deepEqual(error.qweather.invalidParams, ['latitude: 113.034: out of range']);
        assert.equal(
          JSON.stringify(error.qweather).includes('[object Object]'),
          false,
          'object entries must not collapse to [object Object]'
        );
        return true;
      }
    );
  });

  it('skips blank object parts and falls back to JSON for unknown shapes', async () => {
    // undefined / null / '' parts are skipped, the rest is joined with ': '.
    fail(
      400,
      qweatherErrorBody(400, {
        invalidParams: [
          { param: 'lat', value: '', message: null },
          { param: 'p', value: { min: 1, max: 2 }, message: 'bad' },
        ],
      })
    );

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.deepEqual(error.qweather.invalidParams, ['lat', 'p: {"min":1,"max":2}: bad']);
        return true;
      }
    );

    // An object with none of param/value/message is serialised as JSON.
    const oddEntry = { code: 'XYZ', hint: 'nope' };
    fail(400, qweatherErrorBody(400, { invalidParams: [oddEntry] }));

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.deepEqual(error.qweather.invalidParams, [JSON.stringify(oddEntry)]);
        return true;
      }
    );
  });

  it('redacts credentials carried inside object invalidParams entries', async () => {
    const jwtish = 'eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkZXYifQ.c2lnbmF0dXJl';
    const pem = '-----BEGIN PRIVATE KEY-----\nZmFrZS1rZXktbWF0ZXJpYWw=\n-----END PRIVATE KEY-----';
    fail(
      401,
      qweatherErrorBody(401, {
        invalidParams: [
          { param: API_KEY, value: `Bearer ${jwtish}`, message: pem },
          { note: API_KEY },
        ],
      })
    );

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        const blob = error.qweather.invalidParams.join('\n');
        assert.equal(blob.includes(API_KEY), false, 'API key must be redacted');
        assert.equal(blob.includes('eyJhbGci'), false, 'JWT-looking run must be redacted');
        assert.equal(blob.includes('ZmFrZS1rZXktbWF0ZXJpYWw='), false, 'PEM body must be redacted');
        assert.equal(blob.includes('-----BEGIN'), false, 'PEM markers must be redacted');
        assert.ok(blob.includes('Bearer [redacted]'));
        assert.ok(blob.includes('[redacted-pem]'));
        assert.ok(blob.includes('[redacted]'));
        return true;
      }
    );
  });

  it('yields [] when invalidParams is not an array', async () => {
    for (const bad of ['longitude', { param: 'latitude' }, 42, null, true]) {
      fail(400, qweatherErrorBody(400, { invalidParams: bad }));

      await assert.rejects(
        () => qweather.fetchWeather(CONFIG),
        (error) => {
          assert.deepEqual(error.qweather.invalidParams, [], `bad=${JSON.stringify(bad)}`);
          return true;
        }
      );
    }
  });

  it('caps 25 object entries at exactly 20 after normalisation', async () => {
    fail(
      400,
      qweatherErrorBody(400, {
        invalidParams: Array.from({ length: 25 }, (_, index) => ({
          param: `p-${index}`,
          value: String(index),
          message: 'bad',
        })),
      })
    );

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.equal(error.qweather.invalidParams.length, 20);
        assert.equal(error.qweather.invalidParams[0], 'p-0: 0: bad');
        assert.equal(error.qweather.invalidParams[19], 'p-19: 19: bad');
        return true;
      }
    );
  });
});

describe('fetchWeather() — nested `error` envelope (amendment v2)', () => {
  const nestedBody = (status, overrides = {}) => ({
    error: {
      status,
      type: `https://upstream.test/errors/${status}`,
      title: `Nested Title ${status}`,
      detail: `nested detail ${status}`,
      invalidParams: ['longitude', 'latitude'],
      ...overrides,
    },
  });

  it('reads the real QWeather nested 403 body', async () => {
    const body = {
      error: {
        status: 403,
        type: 'https://dev.qweather.com/docs/resource/error-code/#invalid-host',
        title: 'Invalid Host',
        detail: 'An invalid or unauthorized API Host.',
        invalidParams: ['longitude', 'latitude'],
      },
    };
    fail(403, body);

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.qweather.status, 403);
        assert.equal(error.qweather.type, body.error.type);
        assert.equal(error.qweather.title, 'Invalid Host');
        assert.equal(error.qweather.detail, 'An invalid or unauthorized API Host.');
        assert.ok(error.qweather.title.length > 0, 'nested title must not be lost');
        assert.ok(error.qweather.detail.length > 0, 'nested detail must not be lost');
        assert.deepEqual(error.qweather.invalidParams, ['longitude', 'latitude']);
        assert.ok(error.message.includes('Invalid Host'), 'message carries the nested title');
        assert.ok(
          error.message.includes('An invalid or unauthorized API Host.'),
          'message carries the nested detail'
        );
        assert.equal(
          error.message,
          'QWeather upstream error (HTTP 403 Invalid Host): An invalid or unauthorized API Host.'
        );
        return true;
      }
    );
  });

  for (const status of [400, 401, 429, 500]) {
    it(`reads the nested envelope for HTTP ${status}`, async () => {
      const body = nestedBody(status);
      fail(status, body);

      await assert.rejects(
        () => qweather.fetchWeather(CONFIG),
        (error) => {
          assert.equal(error.statusCode, status);
          assert.equal(error.qweather.status, status);
          assert.equal(error.qweather.type, body.error.type);
          assert.equal(error.qweather.title, `Nested Title ${status}`);
          assert.equal(error.qweather.detail, `nested detail ${status}`);
          assert.ok(error.qweather.title.length > 0);
          assert.ok(error.qweather.detail.length > 0);
          assert.deepEqual(error.qweather.invalidParams, ['longitude', 'latitude']);
          assert.ok(error.message.includes(`Nested Title ${status}`));
          assert.ok(error.message.includes(`nested detail ${status}`));
          return true;
        }
      );
    });
  }

  it('still reads the flat top-level shape when the body is not nested', async () => {
    const body = qweatherErrorBody(401, { title: 'Flat Title', detail: 'flat detail' });
    assert.equal('error' in body, false);
    fail(401, body);

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.equal(error.statusCode, 401);
        assert.equal(error.qweather.title, 'Flat Title');
        assert.equal(error.qweather.detail, 'flat detail');
        assert.equal(error.qweather.type, body.type);
        assert.deepEqual(error.qweather.invalidParams, ['lat invalid']);
        assert.ok(error.message.includes('Flat Title'));
        return true;
      }
    );
  });

  it('falls back to the top level when body.error is not an object', async () => {
    for (const notAnObject of ['boom', null, 42, true]) {
      const body = qweatherErrorBody(400, {
        error: notAnObject,
        title: 'Top Title',
        detail: 'top detail',
        type: 'https://top.test/type',
      });
      fail(400, body);

      await assert.rejects(
        () => qweather.fetchWeather(CONFIG),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.qweather.title, 'Top Title', `error=${JSON.stringify(notAnObject)}`);
          assert.equal(error.qweather.detail, 'top detail');
          assert.equal(error.qweather.type, 'https://top.test/type');
          assert.deepEqual(error.qweather.invalidParams, ['lat invalid']);
          assert.ok(error.message.includes('Top Title'));
          return true;
        }
      );
    }
  });

  it('uses the top-level code for a 2xx response and keeps the nested fields', async () => {
    respond(200, {
      code: '400',
      error: {
        status: 400,
        type: 'https://upstream.test/errors/400',
        title: 'Invalid Parameter',
        detail: 'lat is out of range',
        invalidParams: ['latitude'],
      },
    });

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.qweather.title, 'Invalid Parameter');
        assert.equal(error.qweather.detail, 'lat is out of range');
        assert.deepEqual(error.qweather.invalidParams, ['latitude']);
        assert.ok(error.message.includes('Invalid Parameter'));
        assert.ok(error.message.includes('lat is out of range'));
        return true;
      }
    );
  });

  it('normalises nested invalidParams objects and redacts nested credentials', async () => {
    const jwtish = 'eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkZXYifQ.c2lnbmF0dXJl';
    const pem = '-----BEGIN PRIVATE KEY-----\nZmFrZS1rZXktbWF0ZXJpYWw=\n-----END PRIVATE KEY-----';
    fail(403, {
      error: {
        status: 403,
        type: `type ${API_KEY}`,
        title: `title Bearer ${jwtish}`,
        detail: `key=${API_KEY} ${pem}`,
        invalidParams: [
          { param: 'latitude', value: '113.034', message: 'out of range' },
          { param: API_KEY, value: `Bearer ${jwtish}`, message: pem },
          { note: API_KEY },
        ],
      },
    });

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.equal(error.qweather.invalidParams[0], 'latitude: 113.034: out of range');
        assert.equal(
          JSON.stringify(error.qweather).includes('[object Object]'),
          false,
          'object entries must not collapse to [object Object]'
        );

        const blob = `${error.message}\n${JSON.stringify(error.qweather)}`;
        assert.equal(blob.includes(API_KEY), false, 'API key must be redacted');
        assert.equal(blob.includes('eyJhbGci'), false, 'JWT-looking run must be redacted');
        assert.equal(blob.includes('ZmFrZS1rZXktbWF0ZXJpYWw='), false, 'PEM body must be redacted');
        assert.equal(blob.includes('-----BEGIN'), false, 'PEM markers must be redacted');
        assert.ok(blob.includes('Bearer [redacted]'));
        assert.ok(blob.includes('[redacted-pem]'));
        assert.ok(blob.includes('[redacted]'));
        return true;
      }
    );
  });
});

describe('fetchWeather() — redaction (item 21)', () => {
  it('redacts the API key, Bearer tokens, JWT-looking runs and PEM blocks', async () => {
    const jwtish = 'eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkZXYifQ.c2lnbmF0dXJl';
    const pem = '-----BEGIN PRIVATE KEY-----\nZmFrZS1rZXktbWF0ZXJpYWw=\n-----END PRIVATE KEY-----';
    const body = {
      code: '401',
      status: 401,
      type: `type ${API_KEY}`,
      title: `title Bearer ${jwtish}`,
      detail: `key=${API_KEY} ${pem}`,
      invalidParams: [API_KEY, jwtish, pem],
    };
    fail(401, body);

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        const blob = `${error.message}\n${JSON.stringify(error.qweather)}`;

        assert.equal(blob.includes(API_KEY), false, 'API key must be redacted');
        assert.equal(blob.includes('eyJhbGci'), false, 'JWT-looking run must be redacted');
        assert.equal(blob.includes('ZmFrZS1rZXktbWF0ZXJpYWw='), false, 'PEM body must be redacted');
        assert.equal(blob.includes('-----BEGIN'), false, 'PEM markers must be redacted');

        assert.ok(blob.includes('[redacted]'), 'API key placeholder');
        assert.ok(blob.includes('Bearer [redacted]'), 'Bearer placeholder');
        assert.ok(blob.includes('[redacted-pem]'), 'PEM placeholder');
        return true;
      }
    );
  });

  it('replaces a bare JWT-looking run with [redacted-jwt]', async () => {
    const jwtish = 'eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkZXYifQ.c2lnbmF0dXJl';
    fail(400, qweatherErrorBody(400, { title: jwtish, detail: `token=${jwtish}`, invalidParams: [jwtish] }));

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        const blob = `${error.message}\n${JSON.stringify(error.qweather)}`;
        assert.equal(blob.includes('eyJhbGci'), false);
        assert.ok(blob.includes('[redacted-jwt]'));
        return true;
      }
    );
  });

  it('truncates every string field to 300 characters', async () => {
    fail(
      400,
      qweatherErrorBody(400, {
        type: 'T'.repeat(500),
        title: 'X'.repeat(400),
        detail: 'D'.repeat(400),
        invalidParams: ['P'.repeat(400)],
      })
    );

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.ok(error.qweather.type.length <= 300);
        assert.ok(error.qweather.title.length <= 300);
        assert.ok(error.qweather.detail.length <= 300);
        assert.ok(error.qweather.invalidParams[0].length <= 300);
        return true;
      }
    );
  });

  it('never echoes host, kid, iss or sub for a benign upstream error', async () => {
    process.env.QWEATHER_KEY_ID = KID;
    process.env.QWEATHER_DEVELOPER_ID = ISS;
    process.env.QWEATHER_PROJECT_ID = SUB;
    process.env.QWEATHER_PRIVATE_KEY_PATH = keyPath;
    fail(403, qweatherErrorBody(403, { title: 'Forbidden', detail: 'no access' }));

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        const blob = `${error.message}\n${JSON.stringify(error.qweather)}`;
        for (const secret of [HOST, API_KEY, KID, ISS, SUB, keyPath]) {
          assert.equal(blob.includes(secret), false, 'error must not echo configuration values');
        }
        return true;
      }
    );
  });
});

describe('fetchWeather() — success mapping (item 22)', () => {
  it('maps the upstream payload onto the Weather model shape', async () => {
    respond(200, {
      code: '200',
      updateTime: '2024-01-02T03:04:05Z',
      now: {
        temp: '12.5',
        icon: '100',
        text: 'Sunny',
        humidity: '55',
        windSpeed: '9.5',
        cloud: '20',
        isDay: '1',
        obsTime: '2024-01-02T03:04:00Z',
      },
    });

    const result = await qweather.fetchWeather(CONFIG);

    assert.deepEqual(Object.keys(result).sort(), WEATHER_MODEL_KEYS);
    assert.equal(result.externalLastUpdate, '2024-01-02T03:04:05Z');
    assert.equal(result.tempC, 12.5);
    assert.equal(result.tempF, 12.5 * 1.8 + 32);
    assert.equal(result.isDay, 1);
    assert.equal(result.cloud, 20);
    assert.equal(result.conditionText, 'Sunny');
    assert.equal(result.conditionCode, 1000, 'QWeather icon 100 -> WeatherAPI 1000');
    assert.equal(result.humidity, 55);
    assert.equal(result.windK, 9.5);
    assert.equal(result.windM, 9.5 * 0.621371);
  });

  it('calls GET https://<host>/weather/v1/current/<lat>/<long> with timeout 8000 and one credential', async () => {
    respond(200, { code: '200', now: { temp: '1', icon: '100' } });

    await qweather.fetchWeather(CONFIG);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `https://${HOST}/weather/v1/current/39.9/116.4`);
    assert.equal(calls[0].options.timeout, 8000);
    assert.deepEqual(calls[0].options.headers, { 'X-QW-Api-Key': API_KEY });
    assert.equal('Authorization' in calls[0].options.headers, false);
  });

  it('derives isDay from the night icon variants when upstream omits it', async () => {
    for (const [icon, expected] of [
      [100, 1],
      [104, 1],
      [150, 0],
      [350, 0],
      [450, 0],
    ]) {
      calls = [];
      respond(200, { code: '200', now: { temp: '1', icon: String(icon) } });
      const result = await qweather.fetchWeather(CONFIG);
      assert.equal(result.isDay, expected, `icon ${icon}`);
    }

    respond(200, { code: '200', now: { temp: '1', icon: '150', isDay: '1' } });
    const explicit = await qweather.fetchWeather(CONFIG);
    assert.equal(explicit.isDay, 1, 'explicit isDay wins');
  });

  it('translates the QWeather icon codes to WeatherAPI condition codes', async () => {
    const cases = [
      [100, 1000],
      [101, 1003],
      [104, 1009],
      [300, 1240],
      [302, 1273],
      [400, 1213],
      [501, 1135],
      [511, 1030],
      [999, 1003],
      [12345, 1003],
    ];

    for (const [icon, expected] of cases) {
      respond(200, { code: '200', now: { temp: '1', icon: String(icon) } });
      const result = await qweather.fetchWeather(CONFIG);
      assert.equal(result.conditionCode, expected, `icon ${icon}`);
    }
  });

  it('falls back to obsTime for externalLastUpdate and 0 for missing numbers', async () => {
    respond(200, { code: '200', now: { icon: '100', obsTime: '2024-05-06T07:08:09Z' } });

    const result = await qweather.fetchWeather(CONFIG);
    assert.equal(result.externalLastUpdate, '2024-05-06T07:08:09Z');
    assert.equal(result.tempC, 0);
    assert.equal(result.humidity, 0);
    assert.equal(result.cloud, 0);
    assert.equal(result.windK, 0);
    assert.equal(result.conditionText, '');
  });

  it('sends only Authorization when the mode is jwt (integration of item 11)', async () => {
    clearQweatherEnv();
    process.env.QWEATHER_API_HOST = HOST;
    process.env.QWEATHER_AUTH_MODE = 'jwt';
    process.env.QWEATHER_KEY_ID = KID;
    process.env.QWEATHER_DEVELOPER_ID = ISS;
    process.env.QWEATHER_PROJECT_ID = SUB;
    process.env.QWEATHER_PRIVATE_KEY_PATH = keyPath;
    process.env.QWEATHER_API_KEY = API_KEY; // present, but must never be sent in jwt mode

    respond(200, { code: '200', now: { temp: '1', icon: '100' } });
    await qweather.fetchWeather(CONFIG);

    const headers = calls[0].options.headers;
    assert.deepEqual(Object.keys(headers), ['Authorization']);
    assert.equal('X-QW-Api-Key' in headers, false);
    assert.match(headers.Authorization, /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const header = JSON.parse(
      Buffer.from(headers.Authorization.split(' ')[1].split('.')[0], 'base64url').toString('utf8')
    );
    assert.equal(header.alg, 'EdDSA');
    assert.equal(header.kid, KID);
  });
});

describe('fetchWeather() — transport failure never leaks credentials', () => {
  /**
   * A real axios transport failure (ECONNREFUSED / ETIMEDOUT / ENOTFOUND) carries
   * `config` (with the live Authorization / X-QW-Api-Key header and the dedicated
   * host + path, i.e. exactly what a logger prints) and `request`. The provider
   * must strip both before rethrowing.
   */
  const URL_PATH = '/weather/v1/current/1/2';
  const REQUEST_URL = `https://${HOST}${URL_PATH}`;

  const makeTransportError = (code, options) => {
    const error = new Error(`connect ${code} ${HOST} (port 443)`);
    error.code = code;
    error.isAxiosError = true;
    error.config = {
      url: REQUEST_URL,
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
      return { name: this.name, message: this.message, code: this.code, config: this.config };
    };
    return error;
  };

  const failTransport = ({ code = 'ECONNREFUSED', mutate } = {}) => {
    axiosStub.get = async (url, options) => {
      calls.push({ url, options });
      const error = makeTransportError(code, options);
      if (mutate) mutate(error);
      throw error;
    };
  };

  const configureJwt = () => {
    clearQweatherEnv();
    process.env.QWEATHER_API_HOST = HOST;
    process.env.QWEATHER_AUTH_MODE = 'jwt';
    process.env.QWEATHER_KEY_ID = KID;
    process.env.QWEATHER_DEVELOPER_ID = ISS;
    process.env.QWEATHER_PROJECT_ID = SUB;
    process.env.QWEATHER_PRIVATE_KEY_PATH = keyPath;
  };

  /** The exact credential that was actually put on the wire for this call. */
  const sentCredential = () => {
    const headers = calls[0].options.headers;
    return headers.Authorization || headers['X-QW-Api-Key'];
  };

  const assertNoLeak = (blob, label) => {
    const text = String(blob);
    assert.equal(text.includes(sentCredential()), false, `${label}: credential leaked`);
    assert.equal(text.includes('Bearer '), false, `${label}: Authorization header leaked`);
    assert.equal(text.includes(HOST), false, `${label}: host leaked`);
    assert.equal(text.includes(URL_PATH), false, `${label}: request URL path leaked`);
  };

  for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']) {
    it(`drops config and request from a jwt-mode ${code} transport error`, async () => {
      configureJwt();
      failTransport({ code });

      await assert.rejects(
        () => qweather.fetchWeather(CONFIG),
        (error) => {
          assert.ok(error instanceof Error);
          assert.equal(error.code, code, 'the transport error code survives');
          assert.equal(error.config, undefined);
          assert.equal(error.request, undefined);
          assert.equal('config' in error, false);
          assert.equal('request' in error, false);
          return true;
        }
      );
    });
  }

  it('never serialises the JWT, API key, host or URL (jwt mode)', async () => {
    configureJwt();
    failTransport();

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assertNoLeak(util.inspect(error, { depth: 5 }), 'util.inspect');
        assertNoLeak(JSON.stringify(error), 'JSON.stringify');
        assertNoLeak(
          JSON.stringify(error, Object.getOwnPropertyNames(error)),
          'JSON.stringify(own property names)'
        );
        assertNoLeak(String(error.stack), 'String(error.stack)');
        return true;
      }
    );
  });

  it('exposes no secrets through err.toJSON when it exists', async () => {
    configureJwt();
    failTransport();

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        if (typeof error.toJSON === 'function') {
          const viaToJSON = error.toJSON();
          assertNoLeak(util.inspect(viaToJSON, { depth: 5 }), 'util.inspect(error.toJSON())');
          assertNoLeak(JSON.stringify(viaToJSON), 'JSON.stringify(error.toJSON())');
        }
        return true;
      }
    );
  });

  it('gives the api-key mode the same treatment', async () => {
    configureApiKey();
    failTransport();

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.equal(error.config, undefined);
        assert.equal(error.request, undefined);
        assert.equal('config' in error, false);
        assert.equal('request' in error, false);
        assertNoLeak(util.inspect(error, { depth: 5 }), 'api-key util.inspect');
        assertNoLeak(
          JSON.stringify(error, Object.getOwnPropertyNames(error)),
          'api-key JSON.stringify(own)'
        );
        assertNoLeak(String(error.stack), 'api-key String(error.stack)');
        return true;
      }
    );
  });

  it('still scrubs the host from the sanitised transport message', async () => {
    configureJwt();
    failTransport();

    await assert.rejects(
      () => qweather.fetchWeather(CONFIG),
      (error) => {
        assert.equal(error.message.includes(HOST), false, 'host must be scrubbed');
        assert.ok(error.message.includes('[redacted-host]'), 'the scrub marker is present');
        assert.match(error.message, /ECONNREFUSED/);
        return true;
      }
    );
  });

  it('does not turn a frozen/sealed axios error into a different error', async () => {
    const variants = [
      ['frozen', (error) => Object.freeze(error)],
      ['sealed', (error) => Object.seal(error)],
      [
        'non-configurable config/request',
        (error) => {
          const { config, request } = error;
          Object.defineProperty(error, 'config', {
            value: config,
            configurable: false,
            enumerable: true,
            writable: true,
          });
          Object.defineProperty(error, 'request', {
            value: request,
            configurable: false,
            enumerable: true,
            writable: true,
          });
        },
      ],
    ];

    for (const [label, mutate] of variants) {
      configureJwt();
      failTransport({ mutate });

      await assert.rejects(
        () => qweather.fetchWeather(CONFIG),
        (error) => {
          assert.ok(error instanceof Error, `${label}: still an Error`);
          assert.match(String(error.message), /ECONNREFUSED/, `${label}: message preserved`);
          assert.equal(error.code, 'ECONNREFUSED', `${label}: code preserved`);
          return true;
        }
      );
    }
  });

  it('leaves the HTTP-error path intact and redacted', async () => {
    const jwtish = 'eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJkZXYifQ.c2lnbmF0dXJl';

    for (const status of [400, 401, 403, 429, 500]) {
      configureApiKey();
      fail(
        status,
        qweatherErrorBody(status, {
          detail: `Bearer ${jwtish} key=${API_KEY}`,
          invalidParams: [API_KEY, jwtish],
        })
      );

      await assert.rejects(
        () => qweather.fetchWeather(CONFIG),
        (error) => {
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
          return true;
        }
      );
    }
  });
});

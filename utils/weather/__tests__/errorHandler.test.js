'use strict';

/**
 * `middleware/errorHandler.js` — the response surface for an upstream QWeather
 * error (contract v1 §4). Additive coverage on top of the 22 numbered items:
 * it proves `err.qweather` reaches the client unchanged while the existing
 * `{ success, error }` shape is preserved.
 *
 * Hermetic: `utils/Logger` and `utils/ErrorResponse` are stubbed in the require
 * cache so nothing is logged and no repository code is touched beyond reading
 * the middleware source.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..', '..', '..');
const loggerPath = require.resolve(path.join(repoRoot, 'utils', 'Logger.js'));
const errorResponsePath = require.resolve(path.join(repoRoot, 'utils', 'ErrorResponse.js'));

const cacheEntry = (filename, exports) => ({
  id: filename,
  filename,
  loaded: true,
  exports,
  children: [],
  paths: [path.dirname(filename)],
});

require.cache[loggerPath] = cacheEntry(loggerPath, class SilentLogger { log() {} });
require.cache[errorResponsePath] = cacheEntry(
  errorResponsePath,
  class ErrorResponse extends Error {}
);

const errorHandler = require(path.join(repoRoot, 'middleware', 'errorHandler.js'));

const QWEATHER_ERROR = {
  status: 429,
  type: 'https://upstream.test/errors/429',
  title: 'Too Many Requests',
  detail: '[redacted] quota exceeded',
  invalidParams: [],
};

let previousNodeEnv = '';

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

beforeEach(() => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

describe('errorHandler()', () => {
  it('passes err.qweather through unchanged with the upstream status code', () => {
    const res = makeRes();
    const error = Object.assign(new Error('QWeather upstream error (HTTP 429 Too Many Requests): quota'), {
      statusCode: 429,
      qweather: QWEATHER_ERROR,
    });

    errorHandler(error, {}, res, () => {});

    assert.equal(res.statusCode, 429);
    assert.deepEqual(res.body, {
      success: false,
      error: error.message,
      qweather: QWEATHER_ERROR,
    });
  });

  it('omits qweather entirely when the error has none', () => {
    const res = makeRes();
    const error = Object.assign(new Error('Weather provider is not configured'), { statusCode: 400 });

    errorHandler(error, {}, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      success: false,
      error: 'Weather provider is not configured',
    });
    assert.equal('qweather' in res.body, false);
  });

  it('defaults to 500 and "Server Error" when the error carries neither', () => {
    const res = makeRes();

    errorHandler(new Error(), {}, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { success: false, error: 'Server Error' });
  });
});

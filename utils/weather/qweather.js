const axios = require('axios');
const qweatherJwt = require('./qweatherJwt');

/**
 * QWeather (和风天气) provider.
 *
 * SECURITY: the API host and the credential live ONLY in server environment
 * variables. They are never written to config.json, never returned by any API
 * and therefore never reach the browser bundle.
 *
 *   QWEATHER_API_HOST=your-api-host.qweatherapi.com   (no scheme, no path)
 *   QWEATHER_AUTH_MODE=jwt | api-key                  (explicit selection)
 *   QWEATHER_API_KEY=<api key>                        (only in api-key mode)
 *   QWEATHER_KEY_ID / QWEATHER_DEVELOPER_ID / QWEATHER_PROJECT_ID
 *   QWEATHER_PRIVATE_KEY_PATH=<pem file>              (only in jwt mode)
 *
 * The auth header is produced by buildAuthHeaders() so the response mapping
 * below never has to know how the request is authenticated.
 */
const NAME = 'qweather';

const AUTH_API_KEY = 'api-key';
const AUTH_JWT = qweatherJwt.AUTH_JWT;

const readEnv = (key) => (process.env[key] || '').trim();

/**
 * The three retired shared/public hosts. They are an explicit denylist guard,
 * never a default: an operator who sets one is refused rather than silently
 * sent to a host that cannot serve account-scoped JWT credentials.
 */
const RETIRED_PUBLIC_HOSTS = new Set([
  'api.qweather.com',
  'devapi.qweather.com',
  'geoapi.qweather.com',
]);

/** Host is a configuration item — nothing is hard-coded or defaulted. */
const getHost = () => {
  const raw = readEnv('QWEATHER_API_HOST').replace(/^https?:\/\//i, '');

  if (!raw) {
    return '';
  }

  // A path, query or fragment means this is a URL, not a bare API host.
  if (/[/?#]/.test(raw)) {
    return '';
  }

  // Bare host, optionally with a port. Anything else (userinfo, IPv6, spaces,
  // scheme leftovers) is refused.
  if (!/^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?$/.test(raw)) {
    return '';
  }

  const hostname = raw.split(':')[0].toLowerCase();

  if (RETIRED_PUBLIC_HOSTS.has(hostname)) {
    return '';
  }

  return raw.toLowerCase();
};

/**
 * Host strings that must never survive in any output: the configured host with
 * its port, plus — when it differs — the bare hostname, because Node's DNS
 * failures (ENOTFOUND) name the host WITHOUT the port. A derived name shorter
 * than MIN_HOST_NEEDLE_LENGTH is dropped so a tiny value cannot redact
 * unrelated text; the full configured host is always used.
 * Shared by redact() and sanitizeTransportError() so the two cannot diverge.
 */
const MIN_HOST_NEEDLE_LENGTH = 4;

const getHostNeedles = () => {
  const host = getHost();

  if (!host) {
    return [];
  }

  const bare = host.split(':')[0];
  const names = [host];

  if (bare !== host && bare.length >= MIN_HOST_NEEDLE_LENGTH) {
    names.push(bare);
  }

  return names;
};

const getApiKey = () => readEnv('QWEATHER_API_KEY');

/**
 * The auth method is selected EXPLICITLY — an unset or unknown
 * QWEATHER_AUTH_MODE means "not configured", never an implicit fallback.
 */
const getAuthMode = () => {
  const mode = readEnv('QWEATHER_AUTH_MODE').toLowerCase();

  if (mode === AUTH_JWT) {
    return qweatherJwt.isJwtConfigured() ? AUTH_JWT : null;
  }

  if (mode === AUTH_API_KEY) {
    return getApiKey() ? AUTH_API_KEY : null;
  }

  return null;
};

/**
 * Exactly one credential is ever emitted: JWT mode returns only the
 * `Authorization` header, api-key mode only `X-QW-Api-Key`, and any other mode
 * (getAuthMode() === null) returns no credential at all. The branches are
 * mutually exclusive and each returns a fresh single-key object, so both keys
 * can never appear together.
 */
const buildAuthHeaders = () => {
  const mode = getAuthMode();

  if (mode === AUTH_JWT) {
    return { Authorization: `Bearer ${qweatherJwt.getToken()}` };
  }

  if (mode === AUTH_API_KEY) {
    return { 'X-QW-Api-Key': getApiKey() };
  }

  return {};
};

const isConfigured = () => Boolean(getHost() && getAuthMode());

/**
 * QWeather icon codes -> WeatherAPI.com condition codes.
 * Flame's weather icons (client/src/components/UI/Icons/WeatherIcon) only know
 * the WeatherAPI codes, so the provider translates instead of touching the UI.
 */
const ICON_TO_CONDITION = {
  100: 1000, // 晴
  101: 1003, // 多云
  102: 1003, // 少云
  103: 1003, // 晴间多云
  104: 1009, // 阴
  150: 1000,
  151: 1003,
  152: 1003,
  153: 1003,
  154: 1009,
  300: 1240, // 阵雨
  301: 1243, // 强阵雨
  302: 1273, // 雷阵雨
  303: 1276, // 强雷阵雨
  304: 1276, // 雷阵雨伴有冰雹
  305: 1183, // 小雨
  306: 1189, // 中雨
  307: 1195, // 大雨
  308: 1195, // 极端降雨
  309: 1153, // 毛毛雨/细雨
  310: 1195, // 暴雨
  311: 1195, // 大暴雨
  312: 1195, // 特大暴雨
  313: 1198, // 冻雨
  314: 1186, // 小到中雨
  315: 1192, // 中到大雨
  316: 1195, // 大到暴雨
  317: 1195, // 暴雨到大暴雨
  318: 1195, // 大暴雨到特大暴雨
  350: 1240,
  351: 1243,
  399: 1189,
  400: 1213, // 小雪
  401: 1219, // 中雪
  402: 1225, // 大雪
  403: 1225, // 暴雪
  404: 1204, // 雨夹雪
  405: 1204, // 雨雪天气
  406: 1249, // 阵雨夹雪
  407: 1255, // 阵雪
  408: 1216, // 小到中雪
  409: 1222, // 中到大雪
  410: 1225, // 大到暴雪
  456: 1213,
  457: 1219,
  499: 1219,
  500: 1030, // 薄雾
  501: 1135, // 雾
  502: 1030, // 霾
  503: 1030, // 扬沙
  504: 1030, // 浮尘
  507: 1030, // 沙尘暴
  508: 1030, // 强沙尘暴
  509: 1135, // 浓雾
  510: 1135, // 强浓雾
  511: 1030, // 中度霾
  512: 1030, // 重度霾
  513: 1030, // 严重霾
  514: 1135, // 大雾
  515: 1135, // 特强浓雾
  900: 1000, // 热
  901: 1003, // 冷
  999: 1003, // 未知
};

const toConditionCode = (icon) => ICON_TO_CONDITION[Number(icon)] || 1003;

/** QWeather night icons are the +50 variants (150-199 / 350-399 / 450-499). */
const isNightIcon = (icon) => {
  const code = Number(icon);
  return (
    (code >= 150 && code < 200) ||
    (code >= 350 && code < 400) ||
    (code >= 450 && code < 500)
  );
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// --- upstream error sanitisation -------------------------------------------
const MAX_FIELD_LENGTH = 300;
const MAX_INVALID_PARAMS = 20;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Scrubs one upstream string. Runs in the contract's order — PEM blocks, then
 * Bearer credentials, then JWT-looking runs, then the literal API key — plus
 * the configured API host (upstream detail text must never echo it back to the
 * client), and finally truncates. Never returns key material, a token, the API
 * key or the host.
 */
const redact = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  let text = String(value);

  text = text.replace(/-----BEGIN[^-]*-----[\s\S]*?-----END[^-]*-----/g, '[redacted-pem]');
  text = text.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]');
  text = text.replace(/eyJ[A-Za-z0-9_.-]*/g, '[redacted-jwt]');

  const apiKey = getApiKey();

  if (apiKey) {
    text = text.split(apiKey).join('[redacted]');
  }

  for (const name of getHostNeedles()) {
    text = text.replace(new RegExp(escapeRegExp(name), 'gi'), '[redacted-host]');
  }

  return text.slice(0, MAX_FIELD_LENGTH);
};

/**
 * QWeather sends plain strings (["longitude","latitude"]) but some error
 * payloads use objects such as {param, value, message}. Flattening keeps the
 * field readable instead of collapsing it to "[object Object]"; the result is
 * still passed through redact() by the caller.
 */
const toInvalidParamText = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return String(entry);
  }

  const parts = ['param', 'value', 'message']
    .map((key) => entry[key])
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => (typeof part === 'object' ? JSON.stringify(part) : String(part)));

  return parts.length ? parts.join(': ') : JSON.stringify(entry);
};

/** Upstream `invalidParams` -> redacted string array, at most 20 entries. */
const redactInvalidParams = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, MAX_INVALID_PARAMS)
    .map((entry) => redact(toInvalidParamText(entry)));
};

/**
 * Builds the sanitized upstream error: `statusCode` for the response handler,
 * a five-field `qweather` detail object and a message with no credential,
 * token, host, URL or request header in it.
 */
const buildUpstreamError = ({ httpStatus, body }) => {
  const envelope = body && typeof body === 'object' ? body : {};

  // AMENDMENT v2: QWeather nests the detail fields under `error`
  // ({"error":{"status":403,"type":"…","title":"…","detail":"…","invalidParams":[…]}}).
  // Use it when it is a non-null object, otherwise fall back to a flat body.
  const source =
    envelope.error && typeof envelope.error === 'object' ? envelope.error : envelope;

  // The API-level `code` stays on the top-level envelope in both shapes.
  const rawCode = Number(envelope.code);
  const rawStatus = Number(source.status);

  let statusCode;

  if (Number.isFinite(httpStatus) && httpStatus >= 400 && httpStatus <= 599) {
    statusCode = httpStatus;
  } else if (Number.isFinite(rawCode) && rawCode >= 400 && rawCode <= 599) {
    statusCode = rawCode;
  } else if (Number.isFinite(httpStatus) && httpStatus > 0) {
    statusCode = httpStatus;
  } else {
    statusCode = 500;
  }

  const status = Number.isFinite(rawStatus) && rawStatus > 0 ? rawStatus : statusCode;
  const type = redact(source.type);
  const title = redact(source.title);
  const detail = redact(source.detail);

  const error = new Error(
    `QWeather upstream error (HTTP ${statusCode}${title ? ' ' + title : ''}): ${
      detail || 'request failed'
    }`
  );

  error.statusCode = statusCode;
  error.qweather = {
    status,
    type,
    title,
    detail,
    invalidParams: redactInvalidParams(source.invalidParams),
  };

  return error;
};

/**
 * Own properties of a raw axios / Node transport error that can carry request
 * or host material: `config` (headers with the Bearer token / API key, plus
 * the URL and host), `request` (the ClientRequest, whose header block repeats
 * both), the socket's `address` / `port`, and `hostname` / `host` (Node's DNS
 * errors name the host they failed on).
 */
const TRANSPORT_LEAK_KEYS = [
  'config',
  'request',
  'response',
  'address',
  'port',
  'hostname',
  'host',
];

/** Removes one property, tolerating frozen/sealed (non-configurable) errors. */
const stripLeakKey = (target, key) => {
  try {
    delete target[key];
  } catch (err) {
    // Non-configurable property: fall through to the assignment below.
  }

  try {
    if (target[key] !== undefined) {
      target[key] = undefined;
    }
  } catch (err) {
    // Frozen/sealed object: `delete` and assignment are both refused.
  }
};

/** Replaces every occurrence of a secret needle in one string property. */
const scrubStringField = (target, key, needles) => {
  try {
    if (typeof target[key] !== 'string') {
      return;
    }

    let text = target[key];

    for (const [needle, replacement] of needles) {
      text = text.split(needle).join(replacement);
    }

    target[key] = text;
  } catch (err) {
    // Non-writable field: nothing more we can do.
  }
};

/**
 * Transport failures (no HTTP response) must never hand a credential or the
 * API host to a logger. errorHandler() prints the whole error object whenever
 * NODE_ENV === 'development' (the repo's tracked .env default), so the
 * rethrown error is reduced to safe scalars:
 *   - `config` / `request` / `response` are deleted (no header, URL or host);
 *   - the socket `address` / `port` and Node's `hostname` / `host` are deleted;
 *   - axios's config-serialising `toJSON()` is replaced with a safe one;
 *   - host and API key are scrubbed from `message` AND `stack`, because a
 *     stack's first line embeds the original, un-scrubbed message.
 * Host needles are the same ones redact() uses (full host + bare hostname when
 * it differs), so a DNS failure naming only the hostname is scrubbed too.
 * The original error object is mutated and returned (identity preserved).
 */
const sanitizeTransportError = (err) => {
  if (!err || typeof err !== 'object') {
    return err;
  }

  const apiKey = getApiKey();
  const needles = getHostNeedles().map((name) => [name, '[redacted-host]']);

  if (apiKey) {
    needles.push([apiKey, '[redacted]']);
  }

  if (needles.length) {
    scrubStringField(err, 'message', needles);
    scrubStringField(err, 'stack', needles);
  }

  for (const key of TRANSPORT_LEAK_KEYS) {
    stripLeakKey(err, key);
  }

  try {
    if (typeof err.toJSON === 'function') {
      err.toJSON = function toJSON() {
        return { name: this.name, message: this.message, code: this.code };
      };
    }
  } catch (err2) {
    // Non-writable toJSON: the deletions above already removed the
    // serialisable credential.
  }

  return err;
};

const fetchWeather = async (config) => {
  if (!isConfigured()) {
    throw new Error('QWeather is not configured');
  }

  const { lat, long } = config;
  const url = `https://${getHost()}/weather/v1/current/${lat}/${long}`;

  let res;

  try {
    res = await axios.get(url, {
      headers: buildAuthHeaders(),
      timeout: 8000,
    });
  } catch (err) {
    if (err && err.response) {
      throw buildUpstreamError({
        httpStatus: err.response.status,
        body: err.response.data,
      });
    }

    throw sanitizeTransportError(err);
  }

  const body = res.data || {};

  // QWeather answers {"code":"200", ...}; anything else is an API level error
  // even when it arrives with a 2xx HTTP status.
  if (body.code !== undefined && String(body.code) !== '200') {
    throw buildUpstreamError({ httpStatus: res.status, body });
  }

  const now = body.now || {};
  const icon = toNumber(now.icon, 100);
  const tempC = toNumber(now.temp);
  // Wind speed comes back in km/h; miles per hour is derived for the UI toggle.
  const windK = toNumber(now.windSpeed);

  return {
    externalLastUpdate: body.updateTime || now.obsTime || new Date().toISOString(),
    tempC,
    tempF: tempC * 1.8 + 32,
    isDay: now.isDay !== undefined ? Number(now.isDay) : isNightIcon(icon) ? 0 : 1,
    cloud: toNumber(now.cloud),
    conditionText: now.text || '',
    conditionCode: toConditionCode(icon),
    humidity: toNumber(now.humidity),
    windK,
    windM: windK * 0.621371,
  };
};

module.exports = {
  NAME,
  isConfigured,
  fetchWeather,
  // exported for tests / future config UI, never contains the credential
  getHost,
  getAuthMode,
  buildAuthHeaders,
  AUTH_API_KEY,
  AUTH_JWT,
};

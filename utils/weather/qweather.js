const axios = require('axios');

/**
 * QWeather (和风天气) provider.
 *
 * SECURITY: the API host and the credential live ONLY in server environment
 * variables. They are never written to config.json, never returned by any API
 * and therefore never reach the browser bundle.
 *
 *   QWEATHER_API_HOST=your-api-host.qweatherapi.com   (no scheme, no path)
 *   QWEATHER_API_KEY=<api key>                        (X-QW-Api-Key)
 *   QWEATHER_JWT=<jwt>                                (optional, future use)
 *
 * The auth header is produced by buildAuthHeaders() so switching to / adding
 * JWT support later does not require touching the response mapping below.
 */
const NAME = 'qweather';

const AUTH_API_KEY = 'api-key';
const AUTH_JWT = 'jwt';

const readEnv = (key) => (process.env[key] || '').trim();

/** Host is a configuration item — nothing is hard-coded. */
const getHost = () =>
  readEnv('QWEATHER_API_HOST')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');

const getApiKey = () => readEnv('QWEATHER_API_KEY');
const getJwt = () => readEnv('QWEATHER_JWT');

/** API key first; JWT is supported by the same code path for later use. */
const getAuthMode = () => (getApiKey() ? AUTH_API_KEY : getJwt() ? AUTH_JWT : null);

const buildAuthHeaders = () => {
  const mode = getAuthMode();

  if (mode === AUTH_JWT) {
    return { Authorization: `Bearer ${getJwt()}` };
  }

  return { 'X-QW-Api-Key': getApiKey() };
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

const fetchWeather = async (config) => {
  if (!isConfigured()) {
    throw new Error('QWeather is not configured');
  }

  const { lat, long } = config;
  const url = `https://${getHost()}/weather/v1/current/${lat}/${long}`;

  const res = await axios.get(url, {
    headers: buildAuthHeaders(),
    timeout: 8000,
  });

  const body = res.data || {};

  // QWeather answers {"code":"200", ...}; anything else is an API level error.
  if (body.code !== undefined && String(body.code) !== '200') {
    throw new Error(`QWeather error: ${body.code}`);
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
};

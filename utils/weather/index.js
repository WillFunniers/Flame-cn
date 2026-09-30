const Weather = require('../../models/Weather');
const loadConfig = require('../loadConfig');
const weatherapi = require('./weatherapi');
const qweather = require('./qweather');

/**
 * Weather provider registry.
 *
 *   Weather UI  ->  GET /api/weather (SQLite, cached)  <-  scheduler / manual refresh
 *                                                            |
 *                                                     weather provider
 *                                                     ├── weatherapi (upstream, config key)
 *                                                     └── qweather   (env credentials only)
 *
 * The stored payload shape (models/Weather.js) is shared by every provider, so
 * the UI never needs to know which provider produced the data.
 */
const PROVIDERS = {
  [weatherapi.NAME]: weatherapi,
  [qweather.NAME]: qweather,
};

const DEFAULT_PROVIDER = weatherapi.NAME;

/** Unknown / missing values fall back to the upstream provider. */
const resolveProviderName = (config) =>
  PROVIDERS[config.weatherProvider] ? config.weatherProvider : DEFAULT_PROVIDER;

const getProvider = (config) => PROVIDERS[resolveProviderName(config)];

/** True when the selected provider has everything it needs to run. */
const isWeatherConfigured = async () => {
  const config = await loadConfig();
  return getProvider(config).isConfigured(config);
};

/**
 * Non-secret status for the settings UI. It intentionally exposes only
 * booleans + the effective auth mode — never the key, host, JWT or any part of
 * the credential configuration.
 */
const getProviderStatus = async () => {
  const config = await loadConfig();
  const provider = resolveProviderName(config);

  return {
    provider,
    configured: PROVIDERS[provider].isConfigured(config),
    authMode: provider === qweather.NAME ? qweather.getAuthMode() : null,
    qweather: {
      configured: qweather.isConfigured(),
      authMode: qweather.getAuthMode(),
    },
    weatherapi: {
      configured: weatherapi.isConfigured(config),
    },
  };
};

// Single-flight guard: concurrent refreshes share one upstream request instead
// of stacking (the 15 minute scheduler job + a manual refresh from the UI).
let inFlight = null;

const fetchAndStore = async (config) => {
  const provider = getProvider(config);
  const payload = await provider.fetchWeather(config);
  return Weather.create(payload);
};

const getExternalWeather = async () => {
  const config = await loadConfig();
  const provider = getProvider(config);

  if (!provider.isConfigured(config)) {
    throw new Error('Weather provider is not configured');
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = fetchAndStore(config).finally(() => {
    inFlight = null;
  });

  return inFlight;
};

module.exports = {
  getExternalWeather,
  getProviderStatus,
  isWeatherConfigured,
  resolveProviderName,
  PROVIDERS,
  DEFAULT_PROVIDER,
};

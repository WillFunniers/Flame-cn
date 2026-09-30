const axios = require('axios');

/**
 * Upstream provider — WeatherAPI.com.
 * This is the original Flame implementation, extracted verbatim into the
 * provider interface so that adding another provider does not touch it.
 */
const NAME = 'weatherapi';

/** The provider is enabled when the (upstream) API key is present in config. */
const isConfigured = (config) => Boolean(config.WEATHER_API_KEY);

/** Fetches the current weather and returns a payload matching the Weather model. */
const fetchWeather = async (config) => {
  const { WEATHER_API_KEY: secret, lat, long } = config;

  const res = await axios.get(
    `http://api.weatherapi.com/v1/current.json?key=${secret}&q=${lat},${long}`,
    { timeout: 8000 }
  );

  const cursor = res.data.current;

  return {
    externalLastUpdate: cursor.last_updated,
    tempC: cursor.temp_c,
    tempF: cursor.temp_f,
    isDay: cursor.is_day,
    cloud: cursor.cloud,
    conditionText: cursor.condition.text,
    conditionCode: cursor.condition.code,
    humidity: cursor.humidity,
    windK: cursor.wind_kph,
    windM: cursor.wind_mph,
  };
};

module.exports = { NAME, isConfigured, fetchWeather };

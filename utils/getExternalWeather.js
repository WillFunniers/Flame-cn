const { getExternalWeather } = require('./weather');

/**
 * Backwards compatible entry point kept for existing callers
 * (utils/jobs.js, controllers/weather/updateWeather.js).
 *
 * The implementation moved to utils/weather/ so that multiple weather
 * providers can be selected without touching the call sites.
 */
module.exports = getExternalWeather;

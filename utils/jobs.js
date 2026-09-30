const schedule = require('node-schedule');
const getExternalWeather = require('./getExternalWeather');
const clearWeatherData = require('./clearWeatherData');
const { isWeatherConfigured } = require('./weather');
const Sockets = require('../Sockets');
const Logger = require('./Logger');
const logger = new Logger();

module.exports = async function () {
  // The selected weather provider decides whether the scheduler runs at all
  // (upstream: WEATHER_API_KEY present; qweather: env credentials present).
  const weatherEnabled = await isWeatherConfigured();

  if (weatherEnabled) {
    // Update weather data every 15 minutes
    const weatherJob = schedule.scheduleJob(
      'updateWeather',
      '0 */15 * * * *',
      async () => {
        try {
          const weatherData = await getExternalWeather();

          Sockets.getSocket('weather').socket.send(JSON.stringify(weatherData));
        } catch (err) {
          logger.log(err.message, 'ERROR');
        }
      }
    );

    // Clear old weather data every 4 hours
    const weatherCleanerJob = schedule.scheduleJob(
      'clearWeather',
      '0 5 */4 * * *',
      async () => {
        clearWeatherData();
      }
    );
  }
};

import { useState, useEffect, Fragment } from 'react';
import axios from 'axios';

// Redux
import { useSelector } from 'react-redux';

// Typescript
import {
  Weather,
  WeatherProviderStatus,
  ApiResponse,
} from '../../../interfaces';

// CSS
import classes from './WeatherWidget.module.css';

// UI
import { WeatherIcon } from '../../UI';
import { State } from '../../../store/reducers';
import { weatherTemplate } from '../../../utility/templateObjects/weatherTemplate';

export const WeatherWidget = (): JSX.Element => {
  const { loading: configLoading, config } = useSelector(
    (state: State) => state.config
  );

  const [weather, setWeather] = useState<Weather>(weatherTemplate);
  const [isLoading, setIsLoading] = useState(true);
  // Whether the selected provider can actually deliver data. The status is a
  // non-secret flag computed on the server (credentials never reach the client).
  const [weatherEnabled, setWeatherEnabled] = useState(false);

  // Provider status (which provider is selected + is it configured)
  useEffect(() => {
    axios
      .get<ApiResponse<WeatherProviderStatus>>('/api/weather/status')
      .then((data) => setWeatherEnabled(Boolean(data.data.data?.configured)))
      .catch((err) => console.log(err));
  }, []);

  // Initial request to get data
  useEffect(() => {
    axios
      .get<ApiResponse<Weather[]>>('/api/weather')
      .then((data) => {
        const weatherData = data.data.data[0];
        if (weatherData) {
          setWeather(weatherData);
        }
        setIsLoading(false);
      })
      .catch((err) => console.log(err));
  }, []);

  // Open socket for data updates
  useEffect(() => {
    const socketProtocol =
      document.location.protocol === 'http:' ? 'ws:' : 'wss:';
    const socketAddress = `${socketProtocol}//${window.location.host}/socket`;
    const webSocketClient = new WebSocket(socketAddress);

    webSocketClient.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setWeather({
        ...weather,
        ...data,
      });
    };

    return () => webSocketClient.close();
  }, []);

  return (
    <div className={classes.WeatherWidget}>
      {!configLoading && weatherEnabled && weather.id > 0 && (
        <Fragment>
          <div className={classes.WeatherIcon}>
            <WeatherIcon
              weatherStatusCode={weather.conditionCode}
              isDay={weather.isDay}
            />
          </div>
          <div className={classes.WeatherDetails}>
            {/* TEMPERATURE */}
            {config.isCelsius ? (
              <span>{weather.tempC}°C</span>
            ) : (
              <span>{Math.round(weather.tempF)}°F</span>
            )}

            {/* ADDITIONAL DATA */}
            <span>{weather[config.weatherData]}%</span>
          </div>
        </Fragment>
      )}
    </div>
  );
};

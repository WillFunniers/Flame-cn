import { Model } from '.';

export interface Weather extends Model {
  externalLastUpdate: string;
  tempC: number;
  tempF: number;
  isDay: number;
  cloud: number;
  conditionText: string;
  conditionCode: number;
  humidity: number;
  windK: number;
  windM: number;
}

/** Selected weather data provider (config value, never a secret). */
export type WeatherProvider = 'weatherapi' | 'qweather';

/**
 * Non-secret provider status returned by GET /api/weather/status.
 * The credential itself never leaves the server.
 */
export interface WeatherProviderStatus {
  provider: WeatherProvider;
  configured: boolean;
  qweather: {
    configured: boolean;
    host: string | null;
    authMode: string | null;
  };
  weatherapi: {
    configured: boolean;
  };
}

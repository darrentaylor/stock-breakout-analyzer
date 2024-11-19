import axios from 'axios';
import { logger } from '../utils/logger.js';

export class AlphaVantageService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
  }

  async getHistoricalData(symbol, interval = 'daily', outputsize = 'compact') {
    try {
      const endpoint = interval === 'daily' ? 'TIME_SERIES_DAILY_ADJUSTED' : 'TIME_SERIES_INTRADAY';
      const response = await axios.get(
        `${this.baseUrl}?function=${endpoint}&symbol=${symbol}&outputsize=${outputsize}&apikey=${this.apiKey}`
      );

      if (response.data?.['Error Message']) {
        throw new Error(`Alpha Vantage API error: ${response.data['Error Message']}`);
      }

      const timeSeriesKey = interval === 'daily' ? 'Time Series (Daily)' : `Time Series (${interval})`;
      const timeSeriesData = response.data[timeSeriesKey];

      if (!timeSeriesData) {
        throw new Error('Invalid API response format');
      }

      return Object.entries(timeSeriesData).map(([timestamp, data]) => ({
        timestamp,
        open: data['1. open'],
        high: data['2. high'],
        low: data['3. low'],
        close: data['4. close'],
        volume: data['5. volume'],
        adjusted_close: data['5. adjusted close'] || data['4. close']
      }));
    } catch (error) {
      logger.error(`Error fetching historical data for ${symbol}:`, error);
      throw error;
    }
  }

  async getIntradayData(symbol) {
    try {
      const response = await axios.get(
        `${this.baseUrl}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${this.apiKey}`
      );

      if (response.data?.['Error Message']) {
        throw new Error(`Alpha Vantage API error: ${response.data['Error Message']}`);
      }

      const timeSeriesData = response.data['Time Series (5min)'];
      if (!timeSeriesData) {
        throw new Error('Invalid API response format');
      }

      return Object.entries(timeSeriesData).map(([timestamp, data]) => ({
        timestamp,
        open: data['1. open'],
        high: data['2. high'],
        low: data['3. low'],
        close: data['4. close'],
        volume: data['5. volume']
      }));
    } catch (error) {
      logger.error(`Error fetching intraday data for ${symbol}:`, error);
      throw error;
    }
  }
}
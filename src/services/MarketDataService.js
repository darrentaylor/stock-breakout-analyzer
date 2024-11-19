import axios from 'axios';
import { DataManager } from './DataManager.js';
import { logger } from '../utils/logger.js';

export class MarketDataService {
  constructor(alphaVantageService) {
    this.alphaVantageService = alphaVantageService;
    this.dataManager = new DataManager();
    this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  async getHistoricalData(symbol, interval = 'daily', outputsize = 'compact') {
    try {
      // Check cache first
      const cacheKey = `${symbol}_${interval}`;
      const cachedData = await this.dataManager.getCachedData(cacheKey, 'historical');
      if (cachedData && this.isDataFresh(cachedData.timestamp)) {
        logger.debug(`Using cached historical data for ${symbol}`);
        return cachedData.data;
      }

      // Fetch new data
      logger.debug(`Fetching historical data for ${symbol}...`);
      const data = await this.alphaVantageService.getHistoricalData(symbol, interval, outputsize);
      
      if (!data || data.length === 0) {
        throw new Error(`No historical data available for ${symbol}`);
      }

      // Format the data
      const formattedData = this.formatHistoricalData(data);

      // Cache the data
      await this.dataManager.cacheData(cacheKey, {
        data: formattedData,
        timestamp: Date.now()
      }, 'historical');

      return formattedData;
    } catch (error) {
      logger.error(`Error fetching historical data for ${symbol}:`, error);
      throw error;
    }
  }

  async fetchMarketData(symbol) {
    try {
      // Check cache first
      const cachedData = await this.dataManager.getCachedData(symbol, 'intraday');
      if (cachedData && this.isDataFresh(cachedData.timestamp)) {
        logger.debug(`Using cached intraday data for ${symbol}`);
        return cachedData.data;
      }

      // Fetch new data
      logger.debug(`Fetching intraday data for ${symbol}...`);
      const data = await this.alphaVantageService.getIntradayData(symbol);

      if (!data || data.length === 0) {
        throw new Error(`No intraday data available for ${symbol}`);
      }

      // Format the data
      const formattedData = this.formatMarketData(data);

      // Cache the data
      await this.dataManager.cacheData(symbol, {
        data: formattedData,
        timestamp: Date.now()
      }, 'intraday');

      return formattedData;
    } catch (error) {
      logger.error(`Error fetching market data for ${symbol}:`, error);
      throw error;
    }
  }

  isDataFresh(timestamp) {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  formatHistoricalData(data) {
    return data.map(item => ({
      timestamp: new Date(item.timestamp).getTime(),
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseInt(item.volume),
      adjusted_close: parseFloat(item.adjusted_close || item.close)
    })).sort((a, b) => a.timestamp - b.timestamp);
  }

  formatMarketData(data) {
    return data.map(item => ({
      timestamp: new Date(item.timestamp).getTime(),
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseInt(item.volume)
    })).sort((a, b) => a.timestamp - b.timestamp);
  }
}
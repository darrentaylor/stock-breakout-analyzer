import axios from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/RateLimiter.js';

export class APIHandler {
  constructor(avKey) {
    this.avKey = avKey;
    this.cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache
    this.rateLimiter = new RateLimiter(5, 60000); // 5 requests per minute
    this.baseURL = 'https://www.alphavantage.co/query';
  }

  async getMarketData(symbol, days = 100) {
    const cacheKey = `market_data_${symbol}`;
    
    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug(`Using cached data for ${symbol}`);
        return cached;
      }

      // Fetch fresh data
      logger.info(`Fetching market data for ${symbol}`);
      await this.rateLimiter.waitForToken();
      
      const response = await axios.get(this.baseURL, {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol,
          apikey: this.avKey,
          outputsize: 'full'
        },
        timeout: 10000
      });

      // Handle API errors
      if (response.data?.['Error Message']) {
        throw new Error(`Alpha Vantage API error: ${response.data['Error Message']}`);
      }
      if (response.data?.['Note']) {
        throw new Error(`API limit reached: ${response.data['Note']}`);
      }

      const timeSeriesData = response.data?.['Time Series (Daily)'];
      if (!timeSeriesData) {
        throw new Error('Invalid API response format');
      }

      // Transform data
      const data = Object.entries(timeSeriesData)
        .map(([date, values]) => ({
          timestamp: new Date(date).toISOString(),
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
          volume: parseInt(values['5. volume'], 10),
          interval: 'daily'
        }))
        .filter(candle => (
          !isNaN(candle.open) && 
          !isNaN(candle.high) && 
          !isNaN(candle.low) && 
          !isNaN(candle.close) && 
          !isNaN(candle.volume) &&
          candle.volume > 0 &&
          candle.high >= candle.low &&
          candle.high >= candle.open &&
          candle.high >= candle.close &&
          candle.low <= candle.open &&
          candle.low <= candle.close
        ))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(-days);

      if (data.length === 0) {
        throw new Error('No valid market data available');
      }

      // Add technical indicators
      const enrichedData = this.addTechnicalIndicators(data);
      
      logger.info(`Successfully retrieved ${enrichedData.length} days of data for ${symbol}`);
      
      // Cache the results
      this.cache.set(cacheKey, enrichedData);
      
      return enrichedData;

    } catch (error) {
      logger.error(`Failed to fetch market data for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  addTechnicalIndicators(data) {
    return data.map((day, index, array) => {
      // Calculate RSI
      const rsi = this.calculateRSI(array.slice(Math.max(0, index - 14), index + 1));
      
      // Calculate EMAs
      const ema9 = this.calculateEMA(array.slice(0, index + 1), 9);
      const ema20 = this.calculateEMA(array.slice(0, index + 1), 20);
      const ema50 = this.calculateEMA(array.slice(0, index + 1), 50);

      // Calculate volume metrics
      const volumeSMA = this.calculateSMA(
        array.slice(Math.max(0, index - 20), index + 1).map(d => d.volume),
        20
      );

      return {
        ...day,
        indicators: {
          rsi,
          ema9,
          ema20,
          ema50,
          volumeSMA,
          relativeVolume: day.volume / volumeSMA
        }
      };
    });
  }

  calculateRSI(data, periods = 14) {
    if (data.length < periods + 1) return null;
    
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < data.length; i++) {
      const difference = data[i].close - data[i - 1].close;
      if (difference >= 0) {
        gains += difference;
      } else {
        losses -= difference;
      }
    }

    const avgGain = gains / periods;
    const avgLoss = losses / periods;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateEMA(data, periods) {
    if (data.length < periods) return null;
    
    const multiplier = 2 / (periods + 1);
    let ema = data[0].close;

    for (let i = 1; i < data.length; i++) {
      ema = (data[i].close - ema) * multiplier + ema;
    }

    return ema;
  }

  calculateSMA(data, periods) {
    if (data.length < periods) return null;
    return data.slice(-periods).reduce((sum, val) => sum + val, 0) / periods;
  }
}
import { logger } from './logger.js';
import axios from 'axios';
import { BollingerBands } from '../indicators/BollingerBands.js';

export class TechnicalAnalysis {
  constructor() {
    this.rsiPeriod = 14;
    this.emaPeriod = 20;
    this.macdFast = 12;
    this.macdSlow = 26;
    this.macdSignal = 9;
    this.bbPeriod = 20;
    this.bbStdDev = 2;
  }

  calculateRSI(data) {
    console.log('\nDEBUG: Calculating RSI...');
    console.log('Data points available:', data.length);
    console.log('Sample data point:', data[0]);
    
    let gains = 0;
    let losses = 0;

    // Calculate initial RSI
    for (let i = 1; i < this.rsiPeriod; i++) {
      const difference = data[i].close - data[i - 1].close;
      if (difference >= 0) {
        gains += difference;
      } else {
        losses -= difference;
      }
    }

    const averageGain = gains / this.rsiPeriod;
    const averageLoss = losses / this.rsiPeriod;
    
    if (averageLoss === 0) {
      return 100;
    }
    
    const rs = averageGain / averageLoss;
    return 100 - (100 / (1 + rs));
  }

  analyze(marketData) {
    if (!marketData || marketData.length < 50) {
      console.error('Insufficient market data for analysis');
      return null;
    }

    try {
      // Calculate all technical indicators
      const rsi = this.calculateRSI(marketData);
      const macd = this.calculateMACD(marketData);
      const ema = this.calculateEMA(marketData);
      const bollingerBands = this.calculateBollingerBands(marketData);
      const volume = this.analyzeVolume(marketData);
      const movingAverages = this.calculateMovingAverages(marketData);

      // Determine breakout characteristics
      const breakout = this.analyzeBreakout(marketData, {
        bollingerBands,
        volume,
        macd,
        movingAverages
      });

      return {
        rsi,
        macd,
        ema,
        bollingerBands,
        volume,
        movingAverages,
        breakout,
        direction: breakout.direction,
        probability: breakout.probability
      };
    } catch (error) {
      console.error('Technical analysis error:', error);
      throw error;
    }
  }

  calculateBollingerBands(data) {
    const period = this.bbPeriod;
    const stdDev = this.bbStdDev;
    const prices = data.map(d => d.close);
    
    const sma = prices.slice(0, period).reduce((a, b) => a + b) / period;
    const variance = prices.slice(0, period)
      .reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev),
      width: ((sma + (standardDeviation * stdDev)) - (sma - (standardDeviation * stdDev))) / sma * 100
    };
  }

  calculateSMA(data, period) {
    const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  calculateEMA(data, period) {
    const prices = data.map(d => d.close);
    const multiplier = 2 / (period + 1);
    
    // Start with SMA for first period
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    
    // Calculate EMA for remaining periods
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  calculateMACD(data) {
    const fastEMA = this.calculateEMA(data, this.macdFast);
    const slowEMA = this.calculateEMA(data, this.macdSlow);
    const macd = fastEMA - slowEMA;
    const signal = this.calculateEMA([{close: macd}], this.macdSignal);
    const histogram = macd - signal;

    return {
      trend: histogram > 0 ? 'BULLISH' : 'BEARISH',
      value: macd,
      signal: signal,
      histogram: histogram
    };
  }

  analyzeVolume(data) {
    const averageVolume = data.slice(0, 20)
      .reduce((sum, day) => sum + day.volume, 0) / 20;
    const currentVolume = data[0].volume;
    const volumeRatio = (currentVolume / averageVolume) * 100;

    return {
      current_vs_average: volumeRatio,
      trend: volumeRatio > 110 ? 'INCREASING' : 
             volumeRatio < 90 ? 'DECREASING' : 'NEUTRAL',
      accumulation: currentVolume > averageVolume
    };
  }

  calculateMovingAverages(data) {
    const sma20 = this.calculateSMA(data, 20);
    const sma50 = this.calculateSMA(data, 50);
    const currentPrice = data[0].close;

    return {
      sma20,
      sma50,
      trend: currentPrice > sma20 && sma20 > sma50 ? 'BULLISH' :
             currentPrice < sma20 && sma20 < sma50 ? 'BEARISH' : 'NEUTRAL',
      priceLocation: currentPrice > sma50 ? 'ABOVE' : 'BELOW'
    };
  }

  analyzeBreakout(data, indicators) {
    const { bollingerBands, volume, macd, movingAverages } = indicators;
    const currentPrice = data[0].close;
    
    // Breakout signals
    const bbSignal = currentPrice > bollingerBands.upper ? 'LONG' :
                    currentPrice < bollingerBands.lower ? 'SHORT' : 'NEUTRAL';
    
    const volumeSignal = volume.current_vs_average > 150 ? 2 :
                          volume.current_vs_average > 120 ? 1 : 0;
    
    const trendStrength = (macd.trend === 'BULLISH' ? 1 : -1) +
                          (movingAverages.trend === 'BULLISH' ? 1 : -1);

    // Combine signals
    const direction = bbSignal !== 'NEUTRAL' ? bbSignal :
                     trendStrength > 0 ? 'LONG' :
                     trendStrength < 0 ? 'SHORT' : 'NEUTRAL';

    const probability = Math.min(100, Math.max(0,
      50 + (volumeSignal * 10) + (Math.abs(trendStrength) * 15)
    ));

    return {
      direction,
      probability,
      confidence: probability,
      timeframe: volumeSignal > 1 ? 'SHORT' :
                trendStrength !== 0 ? 'MEDIUM' : 'LONG'
    };
  }
}
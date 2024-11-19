import { logger } from './logger.js';
import axios from 'axios';
import { BollingerBands } from '../indicators/BollingerBands.js';
import { PatternRecognitionService } from '../services/PatternRecognitionService.js';

export class TechnicalAnalysis {
  constructor() {
    this.rsiPeriod = 14;
    this.emaPeriod = 20;
    this.macdFast = 12;
    this.macdSlow = 26;
    this.macdSignal = 9;
    this.bbPeriod = 20;
    this.bbStdDev = 2;
    this.atrPeriod = 14;
    this.mfiPeriod = 14;
    this.fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
    this.patternRecognition = new PatternRecognitionService();
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
      
      // Add new indicators
      const atr = this.calculateATR(marketData);
      const mfi = this.calculateMFI(marketData);
      const fibonacci = this.calculateFibonacciLevels(marketData);

      // Add pattern recognition
      const patterns = this.patternRecognition.analyzePatterns(marketData);

      // Determine breakout characteristics
      const breakout = this.analyzeBreakout(marketData, {
        bollingerBands,
        volume,
        macd,
        movingAverages,
        atr,
        mfi,
        fibonacci,
        patterns // Include pattern analysis in breakout detection
      });

      return {
        rsi,
        macd,
        ema,
        bollingerBands,
        volume,
        movingAverages,
        atr,
        mfi,
        fibonacci,
        patterns,
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
    const bbCalculator = new BollingerBands(data, this.bbPeriod, this.bbStdDev);
    const bands = bbCalculator.calculate();
    const latest = bands[bands.length - 1];

    // Calculate historical bandwidth stats for context
    const recentBands = bands.slice(-50);  // Last 50 periods
    const bandwidths = recentBands.map(b => b.bandwidth);
    const maxBandwidth = Math.max(...bandwidths);
    const minBandwidth = Math.min(...bandwidths);
    const avgBandwidth = bandwidths.reduce((a, b) => a + b, 0) / bandwidths.length;

    // Determine volatility state
    const volatilityState = 
      latest.bandwidth > avgBandwidth * 1.5 ? 'HIGH' :
      latest.bandwidth < avgBandwidth * 0.5 ? 'LOW' : 'NORMAL';

    // Enhanced squeeze detection
    const squeezeIntensity = 
      latest.squeeze.bandwidthPercentile < 20 ? 'STRONG' :
      latest.squeeze.bandwidthPercentile < 40 ? 'MODERATE' : 'NONE';

    return {
      upper: latest.upper,
      middle: latest.middle,
      lower: latest.lower,
      width: latest.bandwidth,
      squeeze: {
        active: latest.squeeze.isSqueezing,
        intensity: squeezeIntensity,
        bandwidthPercentile: latest.squeeze.bandwidthPercentile,
        currentBandwidth: latest.squeeze.currentBandwidth,
        averageBandwidth: latest.squeeze.averageBandwidth
      },
      volatility: {
        state: volatilityState,
        current: latest.bandwidth,
        average: avgBandwidth,
        max: maxBandwidth,
        min: minBandwidth
      }
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
    let ema = this.calculateSMA(prices, period);
    
    // Calculate EMA for remaining periods
    for (let i = period - 1; i >= 0; i--) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  calculateMACD(data) {
    const prices = data.map(d => d.close);
    const fastEMA = this.calculateEMAValues(prices, this.macdFast);
    const slowEMA = this.calculateEMAValues(prices, this.macdSlow);
    const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
    const signalLine = this.calculateEMAValues(macdLine, this.macdSignal);
    const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

    // Ensure we have valid numbers
    const currentMACD = macdLine[0] || 0;
    const currentSignal = signalLine[0] || 0;
    const currentHistogram = histogram[0] || 0;

    return {
      value: currentMACD,
      signal: currentSignal,
      histogram: currentHistogram,
      trend: currentMACD > currentSignal ? 'BULLISH' : 'BEARISH',
      strength: Math.abs(currentHistogram) > Math.abs(histogram[1] || 0) ? 'INCREASING' : 'DECREASING'
    };
  }

  calculateEMAValues(prices, period) {
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    const emaValues = [ema];
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
      emaValues.unshift(ema); // Add to beginning for correct order
    }
    
    return emaValues;
  }

  analyzeVolume(data) {
    // Calculate volume averages
    const volume10Day = data.slice(0, 10)
      .reduce((sum, day) => sum + day.volume, 0) / 10;
    const volume20Day = data.slice(0, 20)
      .reduce((sum, day) => sum + day.volume, 0) / 20;
    const currentVolume = data[0].volume;

    // Calculate relative volume ratios
    const volumeRatio10Day = (currentVolume / volume10Day) * 100;
    const volumeRatio20Day = (currentVolume / volume20Day) * 100;

    // Calculate On-Balance Volume (OBV)
    let obv = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      const currentClose = data[i].close;
      const previousClose = i < data.length - 1 ? data[i + 1].close : currentClose;
      
      if (currentClose > previousClose) {
        obv += data[i].volume;
      } else if (currentClose < previousClose) {
        obv -= data[i].volume;
      }
    }

    // Calculate OBV momentum (5-day change)
    const obvLag5 = data.slice(5).reduce((acc, day, i) => {
      const close = day.close;
      const prevClose = i < data.length - 6 ? data[i + 6].close : close;
      return acc + (close > prevClose ? day.volume : 
                   close < prevClose ? -day.volume : 0);
    }, 0);
    const obvMomentum = ((obv - obvLag5) / Math.abs(obvLag5)) * 100;

    // Determine volume trend
    const volumeTrend = volumeRatio20Day > 110 ? 'INCREASING' : 
                       volumeRatio20Day < 90 ? 'DECREASING' : 'NEUTRAL';

    // Determine accumulation/distribution
    const accumulation = obvMomentum > 0 && volumeRatio20Day > 100;
    const distribution = obvMomentum < 0 && volumeRatio20Day > 100;

    return {
      averages: {
        tenDay: volume10Day,
        twentyDay: volume20Day
      },
      ratios: {
        tenDay: volumeRatio10Day,
        twentyDay: volumeRatio20Day
      },
      current_vs_average: volumeRatio20Day,
      obv: {
        value: obv,
        momentum: obvMomentum,
        trend: obvMomentum > 10 ? 'BULLISH' :
               obvMomentum < -10 ? 'BEARISH' : 'NEUTRAL'
      },
      current: currentVolume,
      trend: volumeTrend,
      signals: {
        accumulation,
        distribution,
        intensity: volumeRatio20Day > 150 ? 'HIGH' :
                  volumeRatio20Day > 120 ? 'MEDIUM' : 'LOW'
      }
    };
  }

  calculateMovingAverages(data) {
    // Calculate EMAs and SMAs
    const prices = data.map(d => d.close);
    const ema20 = this.calculateEMA(data, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const sma200 = this.calculateSMA(prices, 200);
    const currentPrice = prices[0];

    // Calculate previous values for cross detection
    const prevPrices = data.slice(1).map(d => d.close);
    const prevEma20 = this.calculateEMA(data.slice(1), 20);
    const prevSma50 = this.calculateSMA(prevPrices, 50);
    const prevSma200 = this.calculateSMA(prevPrices, 200);

    // Detect crosses
    const ema20CrossSma50 = {
      bullish: prevEma20 < prevSma50 && ema20 > sma50,
      bearish: prevEma20 > prevSma50 && ema20 < sma50
    };

    const ema20CrossSma200 = {
      bullish: prevEma20 < prevSma200 && ema20 > sma200,
      bearish: prevEma20 > prevSma200 && ema20 < sma200
    };

    const sma50CrossSma200 = {
      bullish: prevSma50 < prevSma200 && sma50 > sma200,
      bearish: prevSma50 > prevSma200 && sma50 < sma200
    };

    // Determine price position
    const pricePosition = {
      aboveEma20: currentPrice > ema20,
      aboveSma50: currentPrice > sma50,
      aboveSma200: currentPrice > sma200,
      status: currentPrice > sma200 ? 
              (currentPrice > sma50 ? 
                (currentPrice > ema20 ? 'STRONG_BULLISH' : 'BULLISH') 
                : 'WEAK_BULLISH')
              : (currentPrice < sma50 ?
                (currentPrice < ema20 ? 'STRONG_BEARISH' : 'BEARISH')
                : 'WEAK_BEARISH')
    };

    // Determine overall trend
    const trend = pricePosition.aboveSma200 && ema20 > sma50 && sma50 > sma200 ? 'BULLISH' :
                 !pricePosition.aboveSma200 && ema20 < sma50 && sma50 < sma200 ? 'BEARISH' : 'NEUTRAL';

    return {
      ema20,
      sma50,
      sma200,
      crosses: {
        ema20_sma50: ema20CrossSma50,
        ema20_sma200: ema20CrossSma200,
        sma50_sma200: sma50CrossSma200,
        hasRecentCross: ema20CrossSma50.bullish || ema20CrossSma50.bearish ||
                       ema20CrossSma200.bullish || ema20CrossSma200.bearish ||
                       sma50CrossSma200.bullish || sma50CrossSma200.bearish
      },
      pricePosition,
      trend
    };
  }

  calculateATR(data) {
    const atr = [];
    let tr = 0;

    for (let i = data.length - 1; i >= 0; i--) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = i < data.length - 1 ? data[i + 1].close : data[i].close;

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      tr = Math.max(tr1, tr2, tr3);

      if (atr.length === 0) {
        atr.unshift(tr);
      } else {
        atr.unshift(((atr[0] * (this.atrPeriod - 1)) + tr) / this.atrPeriod);
      }
    }

    return {
      value: atr[0],
      history: atr,
      volatility: atr[0] > atr[Math.min(20, atr.length - 1)] ? 'INCREASING' : 'DECREASING',
      risk_level: this.calculateRiskLevel(atr[0], data[0].close)
    };
  }

  calculateMFI(data) {
    const mfi = [];
    const typicalPrices = [];
    const moneyFlow = [];

    // Calculate Typical Price and Money Flow
    for (let i = data.length - 1; i >= 0; i--) {
      const tp = (data[i].high + data[i].low + data[i].close) / 3;
      const mf = tp * data[i].volume;
      typicalPrices.unshift(tp);
      moneyFlow.unshift(mf);
    }

    // Calculate MFI
    for (let i = this.mfiPeriod - 1; i < typicalPrices.length; i++) {
      let posFlow = 0;
      let negFlow = 0;

      for (let j = 0; j < this.mfiPeriod; j++) {
        if (typicalPrices[i - j] > typicalPrices[i - j - 1]) {
          posFlow += moneyFlow[i - j];
        } else {
          negFlow += moneyFlow[i - j];
        }
      }

      const mfiValue = 100 - (100 / (1 + posFlow / negFlow));
      mfi.unshift(mfiValue);
    }

    // Determine institutional activity based on MFI and volume
    const institutionalActivity = this.determineInstitutionalActivity(mfi[0], data[0].volume);

    return {
      value: mfi[0],
      history: mfi,
      signal: mfi[0] > 80 ? 'OVERBOUGHT' : 
              mfi[0] < 20 ? 'OVERSOLD' : 'NEUTRAL',
      trend: mfi[0] > mfi[Math.min(5, mfi.length - 1)] ? 'BULLISH' : 'BEARISH',
      institutional_activity: institutionalActivity
    };
  }

  determineInstitutionalActivity(mfiValue, volume) {
    // High MFI with high volume suggests institutional buying
    if (mfiValue > 60 && volume > 1000000) {
      return 'ACCUMULATION';
    }
    // Low MFI with high volume suggests institutional selling
    else if (mfiValue < 40 && volume > 1000000) {
      return 'DISTRIBUTION';
    }
    // Moderate MFI or low volume suggests retail activity
    else {
      return 'NEUTRAL';
    }
  }

  calculateFibonacciLevels(data) {
    const high = Math.max(...data.map(d => d.high));
    const low = Math.min(...data.map(d => d.low));
    const diff = high - low;

    const levels = {};
    this.fibLevels.forEach(level => {
      levels[level] = high - (diff * level);
    });

    const currentPrice = data[0].close;
    const nearestLevel = this.findNearestFibonacciLevel(currentPrice, levels);

    return {
      levels,
      nearest: {
        level: nearestLevel,
        price: levels[nearestLevel]
      },
      support: Object.entries(levels)
        .filter(([_, price]) => price < currentPrice)
        .reduce((acc, [level, price]) => ({...acc, [level]: price}), {}),
      resistance: Object.entries(levels)
        .filter(([_, price]) => price > currentPrice)
        .reduce((acc, [level, price]) => ({...acc, [level]: price}), {})
    };
  }

  findNearestFibonacciLevel(currentPrice, fibLevels) {
    let nearest = {
      level: null,
      distance: Infinity,
      type: null
    };

    for (const level of Object.entries(fibLevels)) {
      const [key, value] = level;
      const distance = Math.abs(currentPrice - value);
      
      if (distance < nearest.distance) {
        nearest = {
          level: key,
          price: value,
          distance: distance,
          type: currentPrice > value ? 'support' : 'resistance'
        };
      }
    }

    return nearest;
  }

  calculateRiskLevel(atr, price) {
    const atrPercent = (atr / price) * 100;
    return atrPercent > 3 ? 'HIGH' :
           atrPercent > 1.5 ? 'MEDIUM' : 'LOW';
  }

  analyzeBreakout(data, indicators) {
    const { bollingerBands, volume, macd, movingAverages, atr, mfi, fibonacci, patterns } = indicators;
    const currentPrice = data[0].close;
    
    // Breakout signals
    const bbSignal = currentPrice > bollingerBands.upper ? 'LONG' :
                    currentPrice < bollingerBands.lower ? 'SHORT' : 'NEUTRAL';
    
    const macdSignal = macd.histogram > 0 ? 'LONG' :
                      macd.histogram < 0 ? 'SHORT' : 'NEUTRAL';
    
    const volumeSignal = volume.ratios.twentyDay > 150 ? 'STRONG' :
                        volume.ratios.twentyDay > 120 ? 'MODERATE' : 'WEAK';
    
    // Pattern-based signals
    let patternSignal = 'NEUTRAL';
    let patternConfidence = 0;
    
    if (patterns.summary.patternsFound) {
      const dominantPattern = patterns.summary.dominantPattern;
      switch (dominantPattern.type) {
        case 'BULL_FLAG':
        case 'BULL_PENNANT':
        case 'ASCENDING_TRIANGLE':
          patternSignal = 'LONG';
          break;
        case 'BEAR_FLAG':
        case 'BEAR_PENNANT':
        case 'DESCENDING_TRIANGLE':
        case 'HEAD_AND_SHOULDERS':
          patternSignal = 'SHORT';
          break;
        case 'SYMMETRIC_TRIANGLE':
          // Use trend direction to determine signal
          patternSignal = movingAverages.trend === 'BULLISH' ? 'LONG' : 'SHORT';
          break;
      }
      patternConfidence = dominantPattern.confidence;
    }

    // ATR for volatility assessment
    const volatility = atr.value / currentPrice * 100; // ATR as percentage of price
    const volatilitySignal = volatility > 3 ? 'HIGH' :
                            volatility > 1.5 ? 'MODERATE' : 'LOW';

    // MFI for institutional activity
    const institutionalSignal = mfi.institutional_activity;

    // Fibonacci levels for support/resistance
    const fibLevels = fibonacci.levels;
    const nearestFibLevel = this.findNearestFibonacciLevel(currentPrice, fibLevels);
    const fibonacciSignal = nearestFibLevel.type === 'resistance' ? 'SHORT' : 'LONG';

    // Calculate combined probability
    const signals = {
      technical: bbSignal === 'LONG' ? 1 : bbSignal === 'SHORT' ? -1 : 0,
      momentum: macdSignal === 'LONG' ? 1 : macdSignal === 'SHORT' ? -1 : 0,
      volume: volumeSignal === 'STRONG' ? 1 : volumeSignal === 'WEAK' ? 0 : 0.5,
      pattern: patternSignal === 'LONG' ? 1 : patternSignal === 'SHORT' ? -1 : 0,
      fibonacci: fibonacciSignal === 'LONG' ? 1 : -1
    };

    // Weight the signals
    const weights = {
      technical: 0.25,
      momentum: 0.2,
      volume: 0.15,
      pattern: 0.25,
      fibonacci: 0.15
    };

    let weightedSum = 0;
    for (const [signal, value] of Object.entries(signals)) {
      weightedSum += value * weights[signal];
    }

    // Determine direction and probability
    const direction = weightedSum > 0.2 ? 'LONG' :
                     weightedSum < -0.2 ? 'SHORT' : 'NEUTRAL';
    
    const probability = Math.min(95, Math.abs(weightedSum) * 100);

    // Confidence adjustment based on pattern recognition
    const confidenceAdjustment = patternConfidence > 0 ? 
                                (patternConfidence - 50) / 100 : 0;

    return {
      direction,
      probability: Math.max(5, Math.min(95, probability * (1 + confidenceAdjustment))),
      confidence: Math.round(probability * (1 + confidenceAdjustment)),
      signals: {
        bollinger: bbSignal,
        macd: macdSignal,
        volume: volumeSignal,
        pattern: patternSignal,
        volatility: volatilitySignal,
        institutional: institutionalSignal,
        fibonacci: fibonacciSignal
      },
      details: {
        patterns: patterns.summary,
        atr: {
          value: atr.value,
          volatility: volatilitySignal
        },
        mfi: {
          value: mfi.value,
          signal: mfi.signal,
          institutional_activity: institutionalSignal
        },
        fibonacci: {
          nearest_level: nearestFibLevel,
          levels: fibLevels
        }
      }
    };
  }
}
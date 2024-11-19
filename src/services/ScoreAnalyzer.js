import { logger } from '../utils/logger.js';

export class ScoreAnalyzer {
  constructor() {
    // Score weights
    this.weights = {
      technical: 0.4,  // 40% weight
      volume: 0.3,    // 30% weight
      momentum: 0.3   // 30% weight
    };

    // Thresholds for trading signals
    this.thresholds = {
      strongBuy: 80,
      buy: 65,
      neutral: 45,
      sell: 35
    };
  }

  calculateScore(marketData, technicalData) {
    try {
      const technical = this.calculateTechnicalScore(technicalData);
      const volume = this.calculateVolumeScore(technicalData.volume);
      const momentum = this.calculateMomentumScore(technicalData);

      const totalScore = Math.round(
        technical * this.weights.technical +
        volume * this.weights.volume +
        momentum * this.weights.momentum
      );

      return {
        total: totalScore,
        technical,
        volume,
        momentum,
        signal: this.generateSignal(totalScore),
        components: {
          technical: this.getTechnicalComponents(technicalData),
          volume: this.getVolumeComponents(technicalData.volume),
          momentum: this.getMomentumComponents(technicalData)
        }
      };
    } catch (error) {
      logger.error('Score calculation failed:', error);
      return null;
    }
  }

  calculateTechnicalScore(technicalData) {
    let score = 0;

    // Trend Analysis (15 points)
    if (technicalData.ema.trend === 'BULLISH') score += 15;
    else if (technicalData.ema.trend === 'NEUTRAL') score += 7;

    // RSI Analysis (10 points)
    const rsi = technicalData.rsi.value;
    if (rsi >= 40 && rsi <= 60) score += 10;
    else if ((rsi > 30 && rsi < 40) || (rsi > 60 && rsi < 70)) score += 5;

    // Pattern Quality (10 points)
    if (technicalData.pattern.confidence > 80) score += 10;
    else if (technicalData.pattern.confidence > 60) score += 7;
    else if (technicalData.pattern.confidence > 40) score += 5;

    // Support/Resistance (5 points)
    const pricePosition = this.analyzePricePosition(technicalData);
    score += pricePosition * 5;

    return Math.min(40, score);
  }

  calculateVolumeScore(volumeData) {
    let score = 0;

    // Volume Trend (10 points)
    if (volumeData.trend === 'INCREASING') score += 10;
    else if (volumeData.trend === 'STABLE') score += 5;

    // Relative Volume (10 points)
    const relativeVolume = volumeData.relative;
    if (relativeVolume > 2.0) score += 10;
    else if (relativeVolume > 1.5) score += 8;
    else if (relativeVolume > 1.2) score += 5;

    // Volume Pattern (10 points)
    if (volumeData.accumulation) score += 10;
    else if (volumeData.current_vs_average > 120) score += 5;

    return Math.min(30, score);
  }

  calculateMomentumScore(technicalData) {
    let score = 0;

    // Squeeze Momentum (15 points)
    if (technicalData.sqzmom.signal === 'BULLISH') {
      score += 15;
    } else if (technicalData.sqzmom.signal === 'NEUTRAL') {
      score += 7;
    }

    // Volatility (15 points)
    const volatility = technicalData.impliedVolatility;
    if (volatility.isLow) score += 15;
    else if (!volatility.isHigh) score += 10;
    else score += 5;

    return Math.min(30, score);
  }

  analyzePricePosition(technicalData) {
    const ema = technicalData.ema.values;
    if (ema.ema9 > ema.ema20 && ema.ema20 > ema.ema50) return 1;
    if (ema.ema9 < ema.ema20 && ema.ema20 < ema.ema50) return 0;
    return 0.5;
  }

  generateSignal(totalScore) {
    if (totalScore >= this.thresholds.strongBuy) return 'STRONG_BUY';
    if (totalScore >= this.thresholds.buy) return 'BUY';
    if (totalScore >= this.thresholds.neutral) return 'NEUTRAL';
    if (totalScore >= this.thresholds.sell) return 'SELL';
    return 'STRONG_SELL';
  }

  getTechnicalComponents(technicalData) {
    return {
      trend: technicalData.ema.trend,
      rsi: technicalData.rsi.value,
      pattern_confidence: technicalData.pattern.confidence,
      price_position: this.analyzePricePosition(technicalData)
    };
  }

  getVolumeComponents(volumeData) {
    return {
      trend: volumeData.trend,
      relative_volume: volumeData.relative,
      accumulation: volumeData.accumulation,
      current_vs_average: volumeData.current_vs_average
    };
  }

  getMomentumComponents(technicalData) {
    return {
      squeeze_momentum: technicalData.sqzmom.signal,
      volatility: technicalData.impliedVolatility.value,
      volatility_state: technicalData.impliedVolatility.isHigh ? 'HIGH' : 
                       technicalData.impliedVolatility.isLow ? 'LOW' : 'NORMAL'
    };
  }

  getTradingRecommendation(score, technicalData) {
    const signal = this.generateSignal(score.total);
    const risk = this.assessRisk(technicalData);
    
    return {
      signal,
      risk_level: risk.level,
      confidence: this.calculateConfidence(score, technicalData),
      time_horizon: this.determineTimeHorizon(technicalData),
      position_size: this.suggestPositionSize(risk.level),
      entry_strategy: this.determineEntryStrategy(signal, technicalData),
      exit_strategy: this.determineExitStrategy(signal, technicalData)
    };
  }

  assessRisk(technicalData) {
    const volatility = technicalData.impliedVolatility.value;
    const volume = technicalData.volume.relative;
    const rsi = technicalData.rsi.value;

    let riskScore = 0;
    if (volatility > 30) riskScore += 2;
    if (volume < 0.8) riskScore += 1;
    if (rsi > 70 || rsi < 30) riskScore += 1;

    return {
      level: riskScore >= 3 ? 'HIGH' : riskScore >= 1 ? 'MEDIUM' : 'LOW',
      factors: {
        volatility: volatility > 30 ? 'HIGH' : 'NORMAL',
        volume: volume < 0.8 ? 'LOW' : 'ADEQUATE',
        rsi: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL'
      }
    };
  }

  calculateConfidence(score, technicalData) {
    const patternConfidence = technicalData.pattern.confidence;
    const scoreConfidence = score.total / 100;
    const volumeQuality = technicalData.volume.relative > 1.2 ? 1 : 0.7;

    return Math.round((patternConfidence + scoreConfidence + volumeQuality) / 3 * 100);
  }

  determineTimeHorizon(technicalData) {
    if (technicalData.pattern.type === 'BREAKOUT') return 'SHORT_TERM';
    if (technicalData.pattern.type === 'CONTINUATION') return 'MEDIUM_TERM';
    return 'LONG_TERM';
  }

  suggestPositionSize(riskLevel) {
    switch (riskLevel) {
      case 'LOW': return 1.0;     // 100% of normal position size
      case 'MEDIUM': return 0.7;  // 70% of normal position size
      case 'HIGH': return 0.5;    // 50% of normal position size
      default: return 0.5;
    }
  }

  determineEntryStrategy(signal, technicalData) {
    if (signal === 'STRONG_BUY') {
      return {
        type: 'AGGRESSIVE',
        method: 'MARKET_ORDER',
        conditions: ['IMMEDIATE_ENTRY']
      };
    }

    return {
      type: 'CONSERVATIVE',
      method: 'LIMIT_ORDER',
      conditions: ['WAIT_FOR_PULLBACK', 'VOLUME_CONFIRMATION']
    };
  }

  determineExitStrategy(signal, technicalData) {
    const volatility = technicalData.impliedVolatility.value;
    const isHighVolatility = volatility > 30;

    return {
      stop_loss: {
        type: isHighVolatility ? 'WIDE' : 'NORMAL',
        percentage: isHighVolatility ? 7 : 5
      },
      take_profit: {
        type: signal === 'STRONG_BUY' ? 'MULTI_TARGET' : 'SINGLE_TARGET',
        levels: signal === 'STRONG_BUY' ? [1.5, 2.0, 2.5] : [1.5]
      },
      trailing_stop: {
        enabled: signal === 'STRONG_BUY',
        percentage: isHighVolatility ? 10 : 7
      }
    };
  }
}
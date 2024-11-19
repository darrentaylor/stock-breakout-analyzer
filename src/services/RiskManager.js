import { logger } from '../utils/logger.js';
import { StopLossService } from './StopLossService.js';

export class RiskManager {
  constructor(defaultRiskRewardRatio = 2) {
    this.stopLossService = new StopLossService();
    this.DEFAULT_RISK_PERCENT = 1; // 1% risk per trade
    this.MAX_RISK_PERCENT = 2; // 2% max risk per trade
    this.POSITION_SCALING = {
      HIGH_CONFIDENCE: 1.0,  // 100% of calculated size
      MEDIUM_CONFIDENCE: 0.75, // 75% of calculated size
      LOW_CONFIDENCE: 0.5   // 50% of calculated size
    };
    this.defaultRiskRewardRatio = defaultRiskRewardRatio;
  }

  calculateDynamicPositionSize(params) {
    const {
      capital,
      currentPrice,
      confidence = 'MEDIUM_CONFIDENCE',
      riskPercent = this.DEFAULT_RISK_PERCENT,
      technicalData
    } = params;

    // Get optimal stop loss level
    const stopLevels = this.stopLossService.calculateStopLoss({
      currentPrice,
      atr: technicalData.atr.value,
      technicalLevels: technicalData.levels,
      patterns: technicalData.patterns,
      volatility: technicalData.volatility
    });

    const stopLevel = stopLevels.optimal.initial;
    const riskAmount = capital * (Math.min(riskPercent, this.MAX_RISK_PERCENT) / 100);
    const stopDistance = Math.abs(currentPrice - stopLevel);
    const basePositionSize = Math.floor(riskAmount / stopDistance);

    // Scale position size based on confidence
    return Math.floor(basePositionSize * this.POSITION_SCALING[confidence]);
  }

  calculatePositionSize(capital, risk, entry, stop) {
    const riskAmount = capital * (Math.min(risk, this.MAX_RISK_PERCENT) / 100);
    const stopDistance = Math.abs(entry - stop);
    return Math.floor(riskAmount / stopDistance);
  }

  generateTradePlan(analysis, capital = 100000) {
    try {
      const { signals, technicalData } = analysis;
      if (!signals) {
        logger.warn('No signals available for trade plan generation');
        return null;
      }

      const entry = signals.entry_points.conservative;
      const stopLevels = this.stopLossService.calculateStopLoss({
        currentPrice: entry,
        atr: technicalData.atr.value,
        technicalLevels: technicalData.levels,
        patterns: technicalData.patterns,
        volatility: technicalData.volatility
      });

      const stop = stopLevels.optimal.initial;
      const target = signals.targets[1]; // Using second target for R:R
      const confidence = this.determineTradeConfidence(analysis);

      const positionSize = this.calculateDynamicPositionSize({
        capital,
        currentPrice: entry,
        confidence,
        technicalData
      });

      const riskReward = (target - entry) / (entry - stop);

      return {
        position_size: positionSize,
        risk_reward: riskReward,
        max_risk: (entry - stop) * positionSize,
        entry_price: entry,
        stop_loss: {
          initial: stop,
          trailing: this.calculateTrailingStops(entry, stopLevels),
          levels: stopLevels
        },
        targets: signals.targets,
        confidence,
        risk_metrics: {
          capital_at_risk: ((entry - stop) * positionSize / capital) * 100,
          max_position_value: positionSize * entry,
          stop_distance_percent: ((entry - stop) / entry) * 100
        }
      };
    } catch (error) {
      logger.error('Error generating trade plan:', error);
      return null;
    }
  }

  calculateTrailingStops(entry, stopLevels) {
    const { optimal, recommendations } = stopLevels;
    
    return {
      conservative: {
        activation: entry * 1.02, // 2% profit
        distance: recommendations.conservative.initial
      },
      moderate: {
        activation: entry * 1.015, // 1.5% profit
        distance: recommendations.moderate.initial
      },
      aggressive: {
        activation: entry * 1.01, // 1% profit
        distance: recommendations.aggressive.initial
      },
      optimal: {
        activation: entry * 1.02,
        distance: optimal.initial,
        timeframe: optimal.timeframe
      }
    };
  }

  determineTradeConfidence(analysis) {
    const { signals, patterns, volatility } = analysis;
    
    // Count confirming signals
    let confirmingSignals = 0;
    if (patterns?.dominantPattern?.confidence > 0.7) confirmingSignals++;
    if (signals.trend_strength > 0.6) confirmingSignals++;
    if (signals.volume_confirmation) confirmingSignals++;
    if (volatility.value < 0.02) confirmingSignals++; // Low volatility is good

    // Determine confidence level
    if (confirmingSignals >= 3) return 'HIGH_CONFIDENCE';
    if (confirmingSignals >= 2) return 'MEDIUM_CONFIDENCE';
    return 'LOW_CONFIDENCE';
  }

  formatStopLossLevel(level, type) {
    return {
      level: typeof level === 'number' ? Number(level.toFixed(2)) : level,
      type: type,
      risk: typeof level === 'number' ? Number((Math.abs(1 - level)).toFixed(4)) : null
    };
  }

  formatTimeBasedLevel(level, period) {
    return {
      level: Number(level.toFixed(2)),
      period: period
    };
  }

  async assessTrade({ symbol, price, technicalData, patterns }) {
    try {
      const atr = technicalData.atr?.value || 0;
      const volatility = technicalData.atr?.volatility || 'UNKNOWN';
      const trend = technicalData.movingAverages?.trend || 'NEUTRAL';
      
      // Calculate technical stop loss
      const technicalStop = price * 0.95; // 5% below current price
      
      // Calculate volatility-based stop loss
      const volatilityStop = price - (atr * 2);
      
      // Time-based stops
      const timeBasedStops = {
        short: this.formatTimeBasedLevel(price * 0.97, 5),
        medium: this.formatTimeBasedLevel(price * 0.95, 10),
        long: this.formatTimeBasedLevel(price * 0.93, 20)
      };

      // Pattern-based stop
      const patternStop = patterns?.dominantPattern ? 
        this.formatStopLossLevel(price * 0.95, patterns.dominantPattern) :
        this.formatStopLossLevel(price * 0.95, null);

      // Trailing stop
      const trailingStop = {
        level: Number((price * 0.995).toFixed(2)),
        activation: Number((price * 1.02).toFixed(2)),
        step: 0.005
      };

      // Calculate recommended stop loss
      const weights = {
        technical: 0.3,
        volatility: 0.3,
        timeBased: 0.2,
        pattern: 0.2
      };

      const recommendedStop = this.calculateWeightedStopLoss(
        technicalStop,
        volatilityStop,
        timeBasedStops.medium.level,
        patternStop.level,
        weights
      );

      // Format all stop losses
      const stopLossLevels = {
        technical: this.formatStopLossLevel(technicalStop, 'TECHNICAL'),
        volatility: this.formatStopLossLevel(volatilityStop, 'VOLATILITY'),
        timeBased: timeBasedStops,
        pattern: patternStop,
        trailing: trailingStop,
        recommended: {
          level: Number(recommendedStop.toFixed(2)),
          risk: Number((Math.abs(1 - recommendedStop/price)).toFixed(4)),
          weights: weights
        }
      };

      // Risk assessment
      const riskLevel = this.assessRiskLevel(volatility, trend, patterns);
      const recommendation = this.generateRecommendation(riskLevel, trend, patterns);
      const confidence = this.calculateConfidence(patterns, trend, volatility);

      const assessment = {
        riskLevel,
        recommendation,
        confidence
      };

      return {
        stopLossLevels,
        riskToReward: {
          ratio: this.defaultRiskRewardRatio,
          riskAmount: Number((price - recommendedStop).toFixed(2)),
          rewardAmount: Number((price - recommendedStop).toFixed(2)) * this.defaultRiskRewardRatio,
          targetPrice: Number((price + ((price - recommendedStop) * this.defaultRiskRewardRatio)).toFixed(2))
        },
        positionSize: this.calculatePositionSize(price, recommendedStop),
        confidence,
        assessment
      };
    } catch (error) {
      console.error('Error in risk assessment:', error);
      return {
        error: 'Failed to assess trade risk',
        details: error.message
      };
    }
  }

  calculateWeightedStopLoss(technical, volatility, timeBased, pattern, weights) {
    return (
      technical * weights.technical +
      volatility * weights.volatility +
      timeBased * weights.timeBased +
      pattern * weights.pattern
    );
  }

  calculatePositionSize(price, stopLoss) {
    const riskPerTrade = 0.02; // 2% risk per trade
    const accountSize = 100000; // Example account size
    const maxRiskAmount = accountSize * riskPerTrade;
    const stopLossDistance = price - stopLoss;
    return Math.floor(maxRiskAmount / stopLossDistance);
  }

  assessRiskLevel(volatility, trend, patterns) {
    if (volatility === 'HIGH') return 'HIGH';
    if (volatility === 'INCREASING' && trend !== 'STRONG_BULLISH') return 'HIGH';
    if (patterns?.patternsFound && patterns.dominantPattern?.includes('BEARISH')) return 'HIGH';
    if (volatility === 'MODERATE') return 'MEDIUM';
    return 'LOW';
  }

  generateRecommendation(riskLevel, trend, patterns) {
    if (riskLevel === 'HIGH') return 'HOLD';
    if (trend === 'STRONG_BULLISH' && patterns?.patternsFound) return 'BUY';
    if (trend === 'STRONG_BEARISH' && patterns?.patternsFound) return 'SELL';
    return 'HOLD';
  }

  calculateConfidence(patterns, trend, volatility) {
    if (!patterns || volatility === 'HIGH') return 'LOW_CONFIDENCE';
    if (patterns.patternsFound && trend !== 'NEUTRAL') return 'HIGH_CONFIDENCE';
    return 'MEDIUM_CONFIDENCE';
  }

  calculateRiskMetrics(price, stopLoss) {
    if (!price || !stopLoss) {
      return {
        riskAmount: 0,
        riskPercentage: 0,
        potentialReward: 0,
        rewardPercentage: 0,
        riskRewardRatio: 0
      };
    }

    const riskAmount = Math.abs(price - stopLoss);
    const riskPercentage = (riskAmount / price) * 100;
    const potentialReward = riskAmount * this.defaultRiskRewardRatio;
    const rewardPercentage = (potentialReward / price) * 100;

    return {
      riskAmount: parseFloat(riskAmount.toFixed(2)),
      riskPercentage: parseFloat(riskPercentage.toFixed(2)),
      potentialReward: parseFloat(potentialReward.toFixed(2)),
      rewardPercentage: parseFloat(rewardPercentage.toFixed(2)),
      riskRewardRatio: this.defaultRiskRewardRatio
    };
  }

  assessRiskLevel(metrics) {
    if (!metrics || !metrics.riskPercentage) {
      return 'UNKNOWN';
    }

    const { riskPercentage } = metrics;
    if (riskPercentage <= 1) return 'LOW';
    if (riskPercentage <= 2) return 'MODERATE';
    if (riskPercentage <= 3) return 'HIGH';
    return 'VERY_HIGH';
  }

  formatStopLossLevels(technical, volatility, time) {
    return {
      technical: this.formatLevel(technical),
      volatility: this.formatLevel(volatility),
      time: this.formatLevel(time)
    };
  }

  formatLevel(level) {
    if (!level || typeof level !== 'object') {
      return {
        price: 'N/A',
        distance: 'N/A',
        percentage: 'N/A'
      };
    }

    return {
      price: level.price ? parseFloat(level.price.toFixed(2)) : 'N/A',
      distance: level.distance ? parseFloat(level.distance.toFixed(2)) : 'N/A',
      percentage: level.percentage ? parseFloat(level.percentage.toFixed(2)) : 'N/A'
    };
  }

  assessRisk(marketData, technicalData) {
    const current = marketData.current;
    const historical = marketData.historical;
    const technical = technicalData.technical;
    const patterns = technicalData.patterns || [];
    const trend = technicalData.trend;
    const volatility = technicalData.volatility;

    // Calculate volatility risk
    const volatilityRisk = this.calculateVolatilityRisk(technical.atr);
    
    // Calculate technical risk
    const technicalRisk = this.calculateTechnicalRisk(technical);
    
    // Calculate market risk
    const marketRisk = this.calculateMarketRisk(trend, patterns);
    
    // Calculate overall confidence
    const confidence = this.calculateConfidence({
      technical,
      patterns,
      trend,
      volatility
    });

    // Calculate overall risk level
    const riskLevels = [volatilityRisk, technicalRisk, marketRisk];
    const riskScores = riskLevels.map(level => level === 'HIGH' ? 3 : level === 'MEDIUM' ? 2 : 1);
    const avgRiskScore = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    
    const overallRisk = avgRiskScore >= 2.5 ? 'HIGH' : 
                       avgRiskScore >= 1.5 ? 'MEDIUM' : 'LOW';

    return {
      overall: overallRisk,
      confidence,
      technical: technicalRisk,
      volatility: volatilityRisk,
      market: marketRisk,
      details: {
        atr: technical.atr,
        patterns,
        trend
      }
    };
  }

  calculateVolatilityRisk(atr) {
    if (!atr) return 'MEDIUM';
    const { value, history } = atr;
    
    // Calculate rate of change in ATR
    const atrChange = history ? 
      (value - history[Math.min(20, history.length - 1)]) / value : 0;
    
    if (atrChange > 0.1 || value > 20) return 'HIGH';
    if (atrChange > 0.05 || value > 10) return 'MEDIUM';
    return 'LOW';
  }

  calculateTechnicalRisk(technical) {
    if (!technical) return 'MEDIUM';
    
    const signals = [];
    
    // RSI risk
    if (technical.rsi) {
      if (technical.rsi.value > 70 || technical.rsi.value < 30) signals.push('HIGH');
      else if (technical.rsi.value > 60 || technical.rsi.value < 40) signals.push('MEDIUM');
      else signals.push('LOW');
    }
    
    // MACD risk
    if (technical.macd) {
      if (Math.abs(technical.macd.histogram) > 2) signals.push('HIGH');
      else if (Math.abs(technical.macd.histogram) > 1) signals.push('MEDIUM');
      else signals.push('LOW');
    }
    
    // Default to MEDIUM if no signals
    if (signals.length === 0) return 'MEDIUM';
    
    // Count risk levels
    const counts = signals.reduce((acc, level) => {
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});
    
    // Return highest occurring risk level
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  calculateMarketRisk(trend, patterns) {
    if (!trend) return 'MEDIUM';
    
    // Higher risk for trend reversals or breakout patterns
    const reversalPatterns = patterns.filter(p => 
      p.type.includes('REVERSAL') || p.type.includes('BREAKOUT')
    ).length;
    
    if (reversalPatterns > 0 || trend === 'REVERSAL') return 'HIGH';
    if (trend === 'SIDEWAYS') return 'MEDIUM';
    return 'LOW';
  }

  calculateConfidence(data) {
    let confidence = 60; // Base confidence
    
    // Adjust based on technical signals
    if (data.technical) {
      if (data.technical.rsi) confidence += 5;
      if (data.technical.macd) confidence += 5;
      if (data.technical.atr) confidence += 5;
    }
    
    // Adjust based on patterns
    if (data.patterns && data.patterns.length > 0) {
      confidence += Math.min(15, data.patterns.length * 5);
    }
    
    // Adjust based on trend strength
    if (data.trend === 'STRONG') confidence += 10;
    else if (data.trend === 'WEAK') confidence -= 10;
    
    // Cap confidence between 0 and 100
    return Math.min(100, Math.max(0, confidence));
  }
}
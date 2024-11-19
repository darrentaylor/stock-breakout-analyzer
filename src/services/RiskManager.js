import { logger } from '../utils/logger.js';
import { StopLossService } from './StopLossService.js';

export class RiskManager {
  constructor() {
    this.stopLossService = new StopLossService();
    this.DEFAULT_RISK_PERCENT = 1; // 1% risk per trade
    this.MAX_RISK_PERCENT = 2; // 2% max risk per trade
    this.POSITION_SCALING = {
      HIGH_CONFIDENCE: 1.0,  // 100% of calculated size
      MEDIUM_CONFIDENCE: 0.75, // 75% of calculated size
      LOW_CONFIDENCE: 0.5   // 50% of calculated size
    };
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
}
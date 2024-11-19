import { logger } from '../utils/logger.js';
import { StopLossService } from './StopLossService.js';

export class EntryAnalyzer {
  constructor() {
    this.VOLUME_THRESHOLD_CONSERVATIVE = 1.2; // 120% of average
    this.VOLUME_THRESHOLD_AGGRESSIVE = 1.5;   // 150% of average
    this.PRICE_THRESHOLD = 0.02;              // 2% from support
    this.MIN_RR_CONSERVATIVE = 1.5;           // 1.5:1 risk/reward
    this.MIN_RR_AGGRESSIVE = 2;               // 2:1 risk/reward
    this.stopLossService = new StopLossService();
  }

  analyzeEntryPoints(marketData, technicalData) {
    try {
      const latest = marketData[marketData.length - 1];
      const support = this.findDynamicSupport(marketData);
      const resistance = this.findDynamicResistance(marketData);
      const volumeMetrics = this.calculateVolumeMetrics(marketData);
      
      const entryAnalysis = {
        conservative: this.analyzeConservativeEntry(latest, support, resistance, volumeMetrics, technicalData),
        aggressive: this.analyzeAggressiveEntry(latest, support, resistance, volumeMetrics, technicalData),
        support_levels: {
          technical: this.findSupportLevels(marketData),
          fibonacci: technicalData.fibonacci.support
        },
        resistance_levels: {
          technical: this.findResistanceLevels(marketData),
          fibonacci: technicalData.fibonacci.resistance
        },
        risk_metrics: {
          atr: technicalData.atr.value,
          risk_level: technicalData.atr.risk_level,
          stop_loss: this.calculateStopLoss(latest.close, technicalData.atr.value),
          position_size: this.calculatePositionSize(technicalData.atr.value, latest.close)
        },
        institutional_flow: {
          mfi_signal: technicalData.mfi.signal,
          activity: technicalData.mfi.institutional_activity
        }
      };

      entryAnalysis.fibonacci_entries = this.analyzeFibonacciEntries(
        latest.close,
        technicalData.fibonacci,
        technicalData.atr.value
      );

      const stopLossLevels = this.stopLossService.calculateStopLoss({
        currentPrice: latest.close,
        atr: technicalData.atr.value,
        technicalLevels: {
          support: support,
          resistance: resistance
        },
        patterns: technicalData.patterns,
        volatility: technicalData.volatility
      });

      entryAnalysis.riskRewardRatio = this.calculateRiskRewardRatio(latest.close, stopLossLevels.optimal.initial, technicalData.targets.primary);

      return entryAnalysis;
    } catch (error) {
      logger.error('Entry point analysis failed:', error);
      return null;
    }
  }

  calculateVolumeMetrics(marketData) {
    const period = 20;
    const recentData = marketData.slice(-period);
    const volumes = recentData.map(d => d.volume);
    
    const average = volumes.reduce((sum, vol) => sum + vol, 0) / period;
    const current = volumes[volumes.length - 1];
    const relative = current / average;
    
    const trend = this.calculateVolumeTrend(volumes);
    
    return {
      average,
      current,
      relative,
      trend,
      increasing: trend > 0.1,
      decreasing: trend < -0.1
    };
  }

  findDynamicSupport(marketData) {
    const period = 20;
    const recentData = marketData.slice(-period);
    const lows = recentData.map(d => d.low);
    const ema = this.calculateEMA(lows, 5);
    return Math.max(Math.min(...lows), ema);
  }

  findDynamicResistance(marketData) {
    const period = 20;
    const recentData = marketData.slice(-period);
    const highs = recentData.map(d => d.high);
    const ema = this.calculateEMA(highs, 5);
    return Math.min(Math.max(...highs), ema);
  }

  calculateEMA(values, period) {
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    
    for (let i = 1; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  calculateVolumeTrend(volumes) {
    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    return (secondAvg - firstAvg) / firstAvg;
  }

  calculateRiskReward(entry, stop, target) {
    const risk = Math.abs(entry - stop);
    const reward = Math.abs(target - entry);
    return risk === 0 ? 0 : reward / risk;
  }

  findSupportLevels(marketData) {
    const period = 20;
    const recentData = marketData.slice(-period);
    const lows = recentData.map(d => d.low);
    
    return {
      strong: Math.min(...lows),
      weak: this.calculateEMA(lows, 5)
    };
  }

  findResistanceLevels(marketData) {
    const period = 20;
    const recentData = marketData.slice(-period);
    const highs = recentData.map(d => d.high);
    
    return {
      strong: Math.max(...highs),
      weak: this.calculateEMA(highs, 5)
    };
  }

  analyzeConservativeEntry(latest, support, resistance, volumeMetrics, technicalData) {
    const price = latest.close;
    const distanceToSupport = Math.abs(price - support) / support;
    const riskReward = this.calculateRiskReward(price, support * 0.99, resistance * 0.95);
    
    const entry = {
      valid: false,
      price: price,
      required_volume: Math.round(volumeMetrics.average * this.VOLUME_THRESHOLD_CONSERVATIVE),
      support_level: support,
      risk_reward: Number(riskReward.toFixed(2)),
      stop_loss: Number((support * 0.99).toFixed(2)),
      target: Number((resistance * 0.95).toFixed(2)),
      conditions: {
        price_near_support: distanceToSupport <= this.PRICE_THRESHOLD,
        volume_sufficient: volumeMetrics.relative >= this.VOLUME_THRESHOLD_CONSERVATIVE,
        risk_reward_met: riskReward >= this.MIN_RR_CONSERVATIVE,
        rsi_favorable: technicalData.rsi.value >= 40 && technicalData.rsi.value <= 60
      }
    };

    entry.valid = Object.values(entry.conditions).every(condition => condition);
    return entry;
  }

  analyzeAggressiveEntry(latest, support, resistance, volumeMetrics, technicalData) {
    const price = latest.close;
    const breakoutLevel = resistance;
    const riskReward = this.calculateRiskReward(
      price,
      breakoutLevel * 0.99,
      breakoutLevel * 1.05
    );
    
    const entry = {
      valid: false,
      price: price,
      required_volume: Math.round(volumeMetrics.average * this.VOLUME_THRESHOLD_AGGRESSIVE),
      breakout_level: Number(breakoutLevel.toFixed(2)),
      risk_reward: Number(riskReward.toFixed(2)),
      stop_loss: Number((breakoutLevel * 0.99).toFixed(2)),
      target: Number((breakoutLevel * 1.05).toFixed(2)),
      conditions: {
        price_near_breakout: (breakoutLevel - price) / price <= this.PRICE_THRESHOLD,
        volume_sufficient: volumeMetrics.relative >= this.VOLUME_THRESHOLD_AGGRESSIVE,
        risk_reward_met: riskReward >= this.MIN_RR_AGGRESSIVE,
        momentum_favorable: technicalData.sqzmom.signal === 'BULLISH'
      }
    };

    entry.valid = Object.values(entry.conditions).every(condition => condition);
    return entry;
  }

  calculateStopLoss(currentPrice, atr) {
    const multiplier = 2; // Conservative stop loss at 2x ATR
    return {
      conservative: currentPrice - (atr * multiplier),
      aggressive: currentPrice - atr
    };
  }

  calculatePositionSize(atr, currentPrice) {
    const riskPercentage = 0.02; // 2% account risk
    const accountSize = 100000; // Example account size
    const riskAmount = accountSize * riskPercentage;
    const positionSize = Math.floor(riskAmount / atr);
    
    return {
      units: positionSize,
      value: positionSize * currentPrice,
      risk_per_share: atr
    };
  }

  analyzeFibonacciEntries(currentPrice, fibLevels, atr) {
    const entries = [];
    
    Object.entries(fibLevels.levels).forEach(([level, price]) => {
      if (Math.abs(currentPrice - price) <= atr) {
        entries.push({
          level,
          price,
          type: price < currentPrice ? 'SUPPORT' : 'RESISTANCE',
          strength: this.calculateFibLevelStrength(level),
          stop_loss: this.calculateStopLoss(price, atr)
        });
      }
    });

    return {
      potential_entries: entries,
      nearest_level: fibLevels.nearest,
      risk_reward: this.calculateRiskReward(entries, currentPrice, atr)
    };
  }

  calculateFibLevelStrength(level) {
    const strengthMap = {
      '0.618': 'STRONG',
      '0.500': 'STRONG',
      '0.382': 'MEDIUM',
      '0.236': 'WEAK',
      '0.786': 'MEDIUM'
    };
    
    return strengthMap[level] || 'MEDIUM';
  }

  calculateRiskReward(entries, currentPrice, atr) {
    return entries.map(entry => ({
      level: entry.level,
      risk: atr * 2, // 2x ATR for stop loss
      reward: Math.abs(currentPrice - entry.price),
      ratio: (Math.abs(currentPrice - entry.price) / (atr * 2)).toFixed(2)
    }));
  }

  calculateRiskRewardRatio(currentPrice, stopLevel, target) {
    const risk = Math.abs(currentPrice - stopLevel);
    const reward = Math.abs(target - currentPrice);
    return reward / risk;
  }
}
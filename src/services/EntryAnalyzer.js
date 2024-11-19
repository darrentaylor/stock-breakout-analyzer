import { logger } from '../utils/logger.js';

export class EntryAnalyzer {
  constructor() {
    this.VOLUME_THRESHOLD_CONSERVATIVE = 1.2; // 120% of average
    this.VOLUME_THRESHOLD_AGGRESSIVE = 1.5;   // 150% of average
    this.PRICE_THRESHOLD = 0.02;              // 2% from support
    this.MIN_RR_CONSERVATIVE = 1.5;           // 1.5:1 risk/reward
    this.MIN_RR_AGGRESSIVE = 2;               // 2:1 risk/reward
  }

  analyzeEntryPoints(marketData, technicalData) {
    try {
      const latest = marketData[marketData.length - 1];
      const support = this.findDynamicSupport(marketData);
      const resistance = this.findDynamicResistance(marketData);
      const volumeMetrics = this.calculateVolumeMetrics(marketData);
      
      return {
        conservative: this.analyzeConservativeEntry(latest, support, resistance, volumeMetrics, technicalData),
        aggressive: this.analyzeAggressiveEntry(latest, support, resistance, volumeMetrics, technicalData),
        support_levels: this.findSupportLevels(marketData),
        resistance_levels: this.findResistanceLevels(marketData)
      };
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
}
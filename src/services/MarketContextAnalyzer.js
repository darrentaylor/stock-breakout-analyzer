import { logger } from '../utils/logger.js';

export class MarketContextAnalyzer {
  constructor(apiHandler) {
    this.apiHandler = apiHandler;
    this.marketIndices = {
      'SPY': 'S&P 500',
      'QQQ': 'NASDAQ',
      'IWM': 'Russell 2000'
    };
  }

  async analyzeMarketContext() {
    try {
      // Get SPY data for market trend
      const spyData = await this.apiHandler.getMarketData('SPY');
      const marketTrend = this.analyzeMarketTrend(spyData);

      // Calculate implied volatility from SPY
      const volatility = this.calculateImpliedVolatility(spyData);

      // Analyze market indices
      const marketIndices = await this.analyzeMarketIndices();

      return {
        market_trend: marketTrend,
        volatility,
        market_indices: marketIndices,
        trading_conditions: this.assessTradingConditions(marketTrend, volatility)
      };

    } catch (error) {
      logger.error('Market context analysis failed:', error);
      return this.getDefaultMarketContext();
    }
  }

  analyzeMarketTrend(marketData) {
    const period = 20;
    const recentData = marketData.slice(-period);
    
    // Calculate EMAs
    const ema20 = this.calculateEMA(recentData.map(d => d.close), 20);
    const ema50 = this.calculateEMA(recentData.map(d => d.close), 50);
    
    // Calculate price momentum
    const priceChange = (recentData[recentData.length - 1].close - recentData[0].close) / recentData[0].close;
    
    // Determine trend
    let trend = 'NEUTRAL';
    if (ema20 > ema50 && priceChange > 0.02) {
      trend = 'BULLISH';
    } else if (ema20 < ema50 && priceChange < -0.02) {
      trend = 'BEARISH';
    }

    return {
      trend,
      strength: Math.abs(priceChange) * 100,
      ema_alignment: ema20 > ema50 ? 'BULLISH' : 'BEARISH',
      momentum: priceChange * 100
    };
  }

  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  calculateImpliedVolatility(marketData) {
    const period = 20;
    const returns = marketData.slice(-period).map((d, i, arr) => {
      if (i === 0) return 0;
      return Math.log(d.close / arr[i - 1].close);
    }).slice(1);

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const annualizedVol = stdDev * Math.sqrt(252);

    return {
      value: Math.round(annualizedVol * 100),
      isHigh: annualizedVol > 0.3,
      isLow: annualizedVol < 0.15,
      trend: this.analyzeVolatilityTrend(marketData)
    };
  }

  analyzeVolatilityTrend(marketData) {
    const period = 10;
    const volatilities = [];
    
    for (let i = period; i < marketData.length; i++) {
      const slice = marketData.slice(i - period, i);
      const returns = slice.map((d, j) => {
        if (j === 0) return 0;
        return Math.log(d.close / slice[j - 1].close);
      }).slice(1);
      
      const variance = returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length;
      volatilities.push(Math.sqrt(variance));
    }
    
    const recent = volatilities.slice(-5);
    const older = volatilities.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    if (recentAvg > olderAvg * 1.1) return 'INCREASING';
    if (recentAvg < olderAvg * 0.9) return 'DECREASING';
    return 'STABLE';
  }

  async analyzeMarketIndices() {
    const indexStrength = {};
    
    try {
      for (const [symbol, name] of Object.entries(this.marketIndices)) {
        const data = await this.apiHandler.getMarketData(symbol);
        indexStrength[name] = this.calculateIndexStrength(data);
      }
      return indexStrength;
    } catch (error) {
      logger.error('Market indices analysis failed:', error);
      return {};
    }
  }

  calculateIndexStrength(marketData) {
    const period = 20;
    const recentData = marketData.slice(-period);
    
    // Calculate price change
    const priceChange = (recentData[recentData.length - 1].close - recentData[0].close) / recentData[0].close;
    
    // Calculate volume trend
    const volumeChange = this.calculateVolumeTrend(recentData);
    
    // Calculate momentum
    const momentum = this.calculateMomentum(recentData);
    
    return {
      price_change: Math.round(priceChange * 100),
      volume_trend: volumeChange > 0.1 ? 'INCREASING' : volumeChange < -0.1 ? 'DECREASING' : 'STABLE',
      momentum: momentum > 0 ? 'POSITIVE' : momentum < 0 ? 'NEGATIVE' : 'NEUTRAL',
      strength: this.calculateStrengthScore(priceChange, volumeChange, momentum)
    };
  }

  calculateVolumeTrend(data) {
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.volume, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.volume, 0) / secondHalf.length;
    
    return (secondAvg - firstAvg) / firstAvg;
  }

  calculateMomentum(data) {
    const closes = data.map(d => d.close);
    const sma = closes.reduce((sum, price) => sum + price, 0) / closes.length;
    return (closes[closes.length - 1] - sma) / sma;
  }

  calculateStrengthScore(priceChange, volumeChange, momentum) {
    let score = 50; // Base score
    
    // Price component (max 20 points)
    score += priceChange * 1000;
    
    // Volume component (max 15 points)
    score += volumeChange * 150;
    
    // Momentum component (max 15 points)
    score += momentum * 150;
    
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  assessTradingConditions(marketTrend, volatility) {
    return {
      overall: this.calculateOverallConditions(marketTrend, volatility),
      risk_level: this.calculateRiskLevel(volatility),
      recommended_position_size: this.calculateRecommendedPositionSize(marketTrend, volatility)
    };
  }

  calculateOverallConditions(marketTrend, volatility) {
    if (marketTrend.trend === 'BULLISH' && !volatility.isHigh) return 'FAVORABLE';
    if (marketTrend.trend === 'BEARISH' || volatility.isHigh) return 'UNFAVORABLE';
    return 'NEUTRAL';
  }

  calculateRiskLevel(volatility) {
    if (volatility.isHigh) return 'HIGH';
    if (volatility.isLow) return 'LOW';
    return 'MODERATE';
  }

  calculateRecommendedPositionSize(marketTrend, volatility) {
    if (volatility.isHigh) return 0.5;  // 50% of normal size
    if (marketTrend.trend === 'BULLISH' && !volatility.isHigh) return 1.0;
    if (marketTrend.trend === 'BEARISH') return 0.5;
    return 0.75;  // 75% for neutral conditions
  }

  getDefaultMarketContext() {
    return {
      market_trend: {
        trend: 'NEUTRAL',
        strength: 0,
        ema_alignment: 'NEUTRAL',
        momentum: 0
      },
      volatility: {
        value: 15,
        isHigh: false,
        isLow: true,
        trend: 'STABLE'
      },
      market_indices: {},
      trading_conditions: {
        overall: 'NEUTRAL',
        risk_level: 'MODERATE',
        recommended_position_size: 0.75
      }
    };
  }
}
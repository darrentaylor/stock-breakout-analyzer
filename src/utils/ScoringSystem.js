import { TechnicalAnalysis } from './TechnicalAnalysis.js';

export class ScoringSystem {
  constructor() {
    this.technicalAnalysis = new TechnicalAnalysis();
  }

  calculate(marketData) {
    const scores = {
      price_action: this.calculatePriceActionScore(marketData),
      volume: this.calculateVolumeScore(marketData),
      technical: this.calculateTechnicalScore(marketData),
      market: this.calculateMarketScore(marketData)
    };

    return Object.values(scores).reduce((total, score) => total + score, 0);
  }

  calculatePriceActionScore(marketData) {
    let score = 0;

    // Consolidation (15 points)
    if (this.technicalAnalysis.isConsolidating(marketData)) {
      score += 15;
    }

    // Higher lows (10 points)
    if (this.technicalAnalysis.hasHigherLows(marketData)) {
      score += 10;
    }

    // EMA position (10 points)
    const emas = this.technicalAnalysis.calculateEMAs(marketData);
    const lastClose = marketData[marketData.length - 1].close;
    if (lastClose > emas.ema50[emas.ema50.length - 1]) {
      score += 10;
    }

    return score;
  }

  calculateVolumeScore(marketData) {
    let score = 0;

    // Volume decline (10 points)
    if (this.technicalAnalysis.hasVolumeDryUp(marketData)) {
      score += 10;
    }

    // Relative volume (5 points)
    const avgVolume = this.technicalAnalysis.calculateAverageVolume(marketData);
    const lastVolume = marketData[marketData.length - 1].volume;
    if (lastVolume > avgVolume * 1.5) {
      score += 5;
    }

    // Volume trend (10 points)
    const volumeTrend = this.calculateVolumeTrend(marketData);
    if (volumeTrend > 0) {
      score += 10;
    }

    return score;
  }

  calculateTechnicalScore(marketData) {
    let score = 0;

    // RSI position (8 points)
    const rsi = this.technicalAnalysis.calculateRSI(marketData);
    const lastRSI = rsi[rsi.length - 1];
    if (lastRSI >= 45 && lastRSI <= 65) {
      score += 8;
    }

    // EMA alignment (10 points)
    const emas = this.technicalAnalysis.calculateEMAs(marketData);
    if (this.checkEMAAlignment(emas)) {
      score += 10;
    }

    // Momentum (7 points)
    if (this.checkMomentum(marketData)) {
      score += 7;
    }

    return score;
  }

  calculateMarketScore(marketData) {
    let score = 0;

    // Basic market trend analysis
    const ema50 = this.technicalAnalysis.calculateEMAs(marketData).ema50;
    const lastClose = marketData[marketData.length - 1].close;
    
    // Market trend (5 points)
    if (lastClose > ema50[ema50.length - 1]) {
      score += 5;
    }

    // Volatility (5 points)
    if (this.checkVolatility(marketData)) {
      score += 5;
    }

    // Market strength (5 points)
    if (this.checkMarketStrength(marketData)) {
      score += 5;
    }

    return score;
  }

  checkEMAAlignment(emas) {
    const last = {
      ema9: emas.ema9[emas.ema9.length - 1],
      ema20: emas.ema20[emas.ema20.length - 1],
      ema50: emas.ema50[emas.ema50.length - 1]
    };
    return last.ema9 > last.ema20 && last.ema20 > last.ema50;
  }

  calculateVolumeTrend(marketData) {
    return this.technicalAnalysis.calculateVolumeTrend(
      marketData.map(d => d.volume)
    );
  }

  checkMomentum(marketData, days = 10) {
    const closes = marketData.slice(-days).map(d => d.close);
    let momentum = 0;
    for (let i = 1; i < closes.length; i++) {
      momentum += closes[i] > closes[i - 1] ? 1 : -1;
    }
    return momentum > 0;
  }

  checkVolatility(marketData, days = 10) {
    const prices = marketData.slice(-days);
    const volatility = prices.reduce((sum, price) => 
      sum + (price.high - price.low) / price.low, 0) / days;
    return volatility < 0.02; // Less than 2% average daily range
  }

  checkMarketStrength(marketData, days = 5) {
    const closes = marketData.slice(-days).map(d => d.close);
    const highs = marketData.slice(-days).map(d => d.high);
    return closes.every((close, i) => close > highs[i] * 0.98); // Closing near highs
  }
}
export class PriceActionAnalyzer {
    constructor() {
      this.lookbackPeriods = {
        macd: {
          fast: 12,
          slow: 26,
          signal: 9
        }
      };
    }
  
    calculateMACD(prices) {
      const fastEMA = this.calculateEMA(prices, this.lookbackPeriods.macd.fast);
      const slowEMA = this.calculateEMA(prices, this.lookbackPeriods.macd.slow);
      
      // Calculate MACD line
      const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
      
      // Calculate Signal line
      const signalLine = this.calculateEMA(macdLine, this.lookbackPeriods.macd.signal);
      
      // Calculate Histogram
      const histogram = macdLine.map((macd, i) => macd - signalLine[i]);
  
      return {
        macdLine,
        signalLine,
        histogram
      };
    }
  
    calculateEMA(prices, period) {
      const multiplier = 2 / (period + 1);
      let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
      const emaValues = [ema];
  
      for (let i = period; i < prices.length; i++) {
        ema = (prices[i] - ema) * multiplier + ema;
        emaValues.push(ema);
      }
  
      return emaValues;
    }
  }
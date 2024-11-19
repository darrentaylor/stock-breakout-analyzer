export class BollingerBands {
    constructor(data, period = 20, multiplier = 2) {
      this.data = data;
      this.period = period;
      this.multiplier = multiplier;
    }
  
    calculate() {
      const prices = this.data.map(d => d.close);
      const bands = [];
      const lookbackPeriod = 20;
  
      for (let i = this.period - 1; i < prices.length; i++) {
        const slice = prices.slice(i - this.period + 1, i + 1);
        const sma = this.calculateSMA(slice);
        const stdDev = this.calculateStandardDeviation(slice, sma);
        const bandwidth = ((this.multiplier * stdDev * 2) / sma) * 100;
  
        // Calculate squeeze metrics
        const recentBandwidths = bands.slice(-lookbackPeriod).map(b => b.bandwidth);
        const averageBandwidth = recentBandwidths.length > 0 ? 
          this.calculateSMA(recentBandwidths) : bandwidth;
        
        const squeezeData = {
          isSqueezing: bandwidth < averageBandwidth * 0.5,
          bandwidthPercentile: (bandwidth / averageBandwidth) * 100,
          averageBandwidth,
          currentBandwidth: bandwidth
        };
  
        bands.push({
          date: this.data[i].date,
          middle: sma,
          upper: sma + (this.multiplier * stdDev),
          lower: sma - (this.multiplier * stdDev),
          bandwidth,
          squeeze: squeezeData
        });
      }
      return bands;
    }
  
    calculateSMA(data) {
      return data.reduce((sum, price) => sum + price, 0) / data.length;
    }
  
    calculateStandardDeviation(data, sma) {
      const squaredDiffs = data.map(price => Math.pow(price - sma, 2));
      const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / data.length;
      return Math.sqrt(variance);
    }
  }
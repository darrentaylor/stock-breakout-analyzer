import { logger } from '../utils/logger.js';
import { TechnicalAnalysis } from '../utils/TechnicalAnalysis.js';
import { OpenAIAnalyzer } from './OpenAIAnalyzer.js';
import { EntryAnalyzer } from './EntryAnalyzer.js';
import { BollingerBands } from '../indicators/BollingerBands.js';
import { LoggerService } from '../services/LoggerService.js';

export class MarketAnalyzer {
  constructor(apiHandler, openAIKey) {
    console.log('Initializing MarketAnalyzer...');
    
    this.apiHandler = apiHandler;
    this.technicalAnalysis = new TechnicalAnalysis();
    
    console.log('Setting up analyzers...');
    try {
      this.aiAnalyzer = new OpenAIAnalyzer(openAIKey, this.technicalAnalysis);
      this.entryAnalyzer = new EntryAnalyzer(this.technicalAnalysis);
      console.log('Analyzers initialized successfully');
    } catch (error) {
      console.error('Error initializing analyzers:', error);
      throw error;
    }
  }

  async analyzeStocks(symbols) {
    const symbolList = Array.isArray(symbols) ? symbols : [symbols];
    const results = [];

    for (const symbol of symbolList) {
      try {
        console.log(`Analyzing ${symbol}...`);
        
        const marketData = await this.apiHandler.getMarketData(symbol);
        if (!marketData?.length) {
          throw new Error('No market data available');
        }
        console.log(`Successfully retrieved ${marketData.length} days of data for ${symbol}`);

        // Calculate technical indicators
        const technicalData = this.technicalAnalysis.analyze(marketData);

        // Get AI analysis
        const aiAnalysis = await this.aiAnalyzer.analyzeStock(symbol, marketData, technicalData);

        // Add breakout analysis to signal analysis section
        const breakoutSignal = technicalData.breakout.direction === 'LONG' ? 1 : 
                             technicalData.breakout.direction === 'SHORT' ? -1 : 0;

        const signals = {
            volume: technicalData.volume.current_vs_average > 150 ? 1 : 0,
            trend: technicalData.movingAverages.trend.includes('BULLISH') ? 1 : -1,
            momentum: technicalData.macd.trend.includes('BULLISH') ? 1 : -1,
            breakout: breakoutSignal
        };

        const signalScore = signals.volume + signals.trend + signals.momentum + signals.breakout;

        const result = {
          symbol,
          timestamp: new Date().toISOString(),
          marketData,
          score: {
            total: aiAnalysis.score.total,
            technical: aiAnalysis.score.technical,
            volume: aiAnalysis.score.volume,
            momentum: aiAnalysis.score.momentum,
            breakout: technicalData.breakout.probability // Add breakout score
          },
          pattern: technicalData.pattern,
          volume_analysis: {
            current_vs_average: technicalData.volume.current_vs_average,
            trend: technicalData.volume.trend,
            accumulation: technicalData.volume.accumulation
          },
          signals: {
            ...aiAnalysis.signals,
            breakout: {
                direction: technicalData.breakout.direction,
                probability: technicalData.breakout.probability,
                confidence: technicalData.breakout.confidence,
                timeframe: technicalData.breakout.timeframe
            }
          },
          analysis: {
            ...aiAnalysis.analysis,
            technical: technicalData
          }
        };

        // Update signal resolution to include breakout
        console.log(`\n  Signal Resolution: ${
            signalScore > 1 ? '🟢 BULLISH' :
            signalScore < -1 ? '🔴 BEARISH' :
            '🟡 NEUTRAL'
        } (Score: ${signalScore})`);

        results.push(result);
        await this.generateReport(symbol, marketData, result);

      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error);
        results.push({
          symbol,
          error: error.message
        });
      }
    }

    return results;
  }

  async analyzeTechnicalIndicators(data) {
    const technicalAnalysis = new TechnicalAnalysis();
    const technicalData = technicalAnalysis.analyze(data);
    
    // Add Bollinger Bands calculation
    const bb = new BollingerBands(data);
    const bbResults = bb.calculate();

    return {
      ...technicalData,
      bollingerBands: {
        current: bbResults[bbResults.length - 1],
        history: bbResults
      }
    };
  }

  async generateReport(symbol, data, analysis) {
    // ... existing code ...

    // Add Bollinger Bands section
    const bb = new BollingerBands(data);
    const bbResults = bb.calculate();
    const currentBB = bbResults[bbResults.length - 1];

    console.log('\nBollinger Bands Analysis:');
    console.log('───────────────────────────────────────');
    console.log(`Middle Band: $${currentBB.middle.toFixed(2)}`);
    console.log(`Upper Band: $${currentBB.upper.toFixed(2)}`);
    console.log(`Lower Band: $${currentBB.lower.toFixed(2)}`);
    console.log(`Standard Deviation: ${currentBB.standardDeviation.toFixed(2)}`);
    
    // Calculate Band Width
    const bandWidth = ((currentBB.upper - currentBB.lower) / currentBB.middle) * 100;
    console.log(`Band Width: ${bandWidth.toFixed(2)}%`);
    
    // Position relative to bands
    const pricePosition = this.getPriceBandPosition(data[data.length - 1].close, currentBB);
    console.log(`Price Position: ${pricePosition}`);

    // Add Breakout Analysis section
    if (analysis?.technical?.breakout) {
      const breakout = analysis.technical.breakout;
      console.log('\nBreakout Analysis:');
      console.log('───────────────────────────────────────');
      
      const directionEmoji = {
        'LONG': '🚀',
        'SHORT': '📉',
        'NEUTRAL': '➡️'
      }[breakout.direction];
      
      console.log(`Direction: ${breakout.direction} ${directionEmoji}`);
      console.log(`Probability: ${breakout.probability}% ${this.getProbabilityEmoji(breakout.probability)}`);
      console.log(`Confidence: ${breakout.confidence}% ${this.getConfidenceEmoji(breakout.confidence)}`);
      console.log(`Timeframe: ${breakout.timeframe} ${this.getTimeframeEmoji(breakout.timeframe)}\n`);
    }
  }

  getPriceBandPosition(price, bands) {
    if (price > bands.upper) return "ABOVE_BANDS ⚠️";
    if (price < bands.lower) return "BELOW_BANDS ⚠️";
    if (price > bands.middle) return "ABOVE_MIDDLE ↗️";
    if (price < bands.middle) return "BELOW_MIDDLE ↘️";
    return "AT_MIDDLE ➡️";
  }

  // Helper methods for emojis
  getProbabilityEmoji(probability) {
    return probability >= 70 ? '🟢' : 
           probability >= 40 ? '🟡' : '🔴';
  }

  getConfidenceEmoji(confidence) {
    return confidence >= 70 ? '🟢' : 
           confidence >= 40 ? '🟡' : '🔴';
  }

  getTimeframeEmoji(timeframe) {
    return {
      'SHORT': '⚡',
      'MEDIUM': '📅',
      'LONG': '📈'
    }[timeframe] || '📅';
  }

  async analyzeLiveMarket(symbol) {
    try {
      LoggerService.log(`Starting live market analysis for ${symbol}`);
      
      const breakoutAnalysis = await this.technicalAnalysis.analyzeWithLiveData(symbol);
      
      // Generate comprehensive report
      await this.generateReport(symbol, breakoutAnalysis);
      
      return breakoutAnalysis;

    } catch (error) {
      LoggerService.error(`Failed to analyze live market for ${symbol}`, error);
      throw error;
    }
  }
}
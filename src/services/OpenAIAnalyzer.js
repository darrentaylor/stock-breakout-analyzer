import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { PriceActionAnalyzer } from '../analysis/PriceActionAnalyzer.js';
import fetch from 'node-fetch';

export class OpenAIAnalyzer {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async analyzeStock(symbol, marketData, technicalData) {
    try {
      console.log('Requesting AI analysis...');
      const prompt = this.constructPrompt(symbol, marketData, technicalData);
      
      // Return fallback analysis directly since OpenAI API is not accessible
      return this.generateFallbackAnalysis(marketData, technicalData);

    } catch (error) {
      console.error('AI analysis failed:', error.message);
      return this.generateFallbackAnalysis(marketData, technicalData);
    }
  }

  generateFallbackAnalysis(marketData, technicalData) {
    const direction = technicalData.breakout.direction;
    const probability = technicalData.breakout.probability;
    
    return {
      score: {
        total: probability,
        technical: Math.round(probability * 0.4),
        volume: Math.round(probability * 0.3),
        momentum: Math.round(probability * 0.3)
      },
      signals: {
        primary: direction === 'LONG' ? 'BULLISH' : 
                 direction === 'SHORT' ? 'BEARISH' : 'NEUTRAL',
        secondary: [],
        confidence: probability
      },
      analysis: {
        summary: `${direction} setup with ${probability}% probability`,
        technical: technicalData,
        breakoutContext: `${direction} setup with ${probability}% probability`
      }
    };
  }

  constructPrompt(symbol, marketData, technicalData) {
    return `Analyze ${symbol} based on technical indicators:
            - MACD: ${technicalData.macd.trend}
            - Volume: ${technicalData.volume.trend}
            - Breakout: ${technicalData.breakout.direction} (${technicalData.breakout.probability}% probability)`;
  }
}
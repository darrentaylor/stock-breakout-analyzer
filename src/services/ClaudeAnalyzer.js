import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';

export class ClaudeAnalyzer {
  constructor(apiKey, technicalAnalysis) {
    this.apiKey = apiKey;
    this.technicalAnalysis = technicalAnalysis;
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  async analyzeStock(symbol, marketData, technicalData) {
    try {
      const analysis = await this.getAIAnalysis(symbol, marketData, technicalData);
      return this.processAnalysis(analysis, marketData);
    } catch (error) {
      logger.error(`Claude analysis failed for ${symbol}:\nError: ${error.message}`, {
        stack: error.stack,
        context: {
          symbol,
          dataPoints: marketData.length,
          technicalIndicators: Object.keys(technicalData)
        }
      });
      return this.generateFallbackAnalysis(marketData, technicalData);
    }
  }

  generateFallbackAnalysis(marketData, technicalData) {
    const latest = marketData[marketData.length - 1];
    return {
      score: {
        total: 50,
        technical: 20,
        volume: 15,
        momentum: 15
      },
      signals: {
        primary: 'NEUTRAL',
        secondary: []
      },
      analysis: {
        summary: 'Fallback analysis due to API error',
        technical: technicalData
      }
    };
  }

  async getAIAnalysis(symbol, marketData, technicalData) {
    const anthropic = new Anthropic({ apiKey: this.apiKey });
    const prompt = this.constructPrompt(symbol, marketData, technicalData);
    
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      
      return response.content;
    } catch (error) {
      throw new Error(`Claude API error: ${error.message}`);
    }
  }
}
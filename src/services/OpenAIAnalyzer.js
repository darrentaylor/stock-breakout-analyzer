import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { PriceActionAnalyzer } from '../analysis/PriceActionAnalyzer.js';

export class OpenAIAnalyzer {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  async analyzeStock(symbol, marketData, technicalData) {
    try {
      console.log('Requesting AI analysis...');
      const prompt = this.constructPrompt(symbol, marketData, technicalData);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-1106-preview",
        messages: [{
          role: "system",
          content: "You are a professional stock market analyst. Analyze the provided market data and technical indicators to provide insights about the stock's current position and potential future movement. Focus on identifying breakout patterns and trend strength."
        }, {
          role: "user",
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 500
      });

      const analysis = completion.choices[0].message.content;
      
      // Parse AI response and combine with technical data
      return this.processAIResponse(analysis, technicalData);

    } catch (error) {
      console.error('AI analysis failed:', error.message);
      logger.error('AI Analysis Error:', error);
      return this.generateFallbackAnalysis(marketData, technicalData);
    }
  }

  constructPrompt(symbol, marketData, technicalData) {
    const recentData = marketData.slice(0, 10); // Last 10 days
    const latestPrice = recentData[0].close;
    const priceChange = ((latestPrice - recentData[1].close) / recentData[1].close * 100).toFixed(2);
    
    return `
Analyze ${symbol} stock with the following data:

Current Price: $${latestPrice}
Daily Change: ${priceChange}%

Technical Indicators:
- RSI: ${technicalData.rsi}
- MACD: ${technicalData.macd.histogram}
- Bollinger Bands: 
  Upper: ${technicalData.bollingerBands.upper}
  Middle: ${technicalData.bollingerBands.middle}
  Lower: ${technicalData.bollingerBands.lower}

Volume Analysis:
- Current Volume: ${recentData[0].volume}
- Average Volume: ${technicalData.volume.average}

Breakout Analysis:
- Direction: ${technicalData.breakout.direction}
- Probability: ${technicalData.breakout.probability}%

Please provide:
1. Overall market sentiment (BULLISH/BEARISH/NEUTRAL)
2. Confidence level (0-100%)
3. Key factors supporting your analysis
4. Potential risks to watch
5. Short-term price target range
`;
  }

  processAIResponse(aiResponse, technicalData) {
    // Extract sentiment and confidence from AI response
    const sentiment = aiResponse.match(/BULLISH|BEARISH|NEUTRAL/)?.[0] || 'NEUTRAL';
    const confidence = parseInt(aiResponse.match(/confidence.*?(\d+)/i)?.[1] || technicalData.breakout.probability);
    
    return {
      score: {
        total: confidence,
        technical: Math.round(confidence * 0.4),
        volume: Math.round(confidence * 0.3),
        momentum: Math.round(confidence * 0.3)
      },
      signals: {
        primary: sentiment,
        secondary: [],
        confidence: confidence
      },
      analysis: {
        summary: aiResponse,
        technical: technicalData,
        breakoutContext: `${technicalData.breakout.direction} setup with ${confidence}% probability based on AI analysis`
      }
    };
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
}
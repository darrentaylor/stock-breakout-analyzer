import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { PriceActionAnalyzer } from '../analysis/PriceActionAnalyzer.js';

export class OpenAIAnalyzer {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  analyze(data) {
    return this.analyzeStock(data.symbol, data.marketData, data.technicalData);
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
    
    // Calculate price action metrics
    const high = Math.max(...recentData.map(d => d.high));
    const low = Math.min(...recentData.map(d => d.low));
    const range = high - low;
    const volatility = (range / low * 100).toFixed(2);
    
    // Calculate momentum indicators
    const rsiTrend = technicalData.rsi > 70 ? 'Overbought' : technicalData.rsi < 30 ? 'Oversold' : 'Neutral';
    const macdTrend = technicalData.macd.histogram > 0 ? 'Bullish' : 'Bearish';
    
    return `
Analyze ${symbol} stock with the following data and provide a comprehensive sentiment analysis:

Market Context:
Current Price: $${latestPrice}
Daily Change: ${priceChange}%
10-day Trading Range: $${low} - $${high}
Volatility: ${volatility}%

Technical Indicators:
- RSI: ${technicalData.rsi} (${rsiTrend})
- MACD: ${technicalData.macd.histogram} (${macdTrend})
- Bollinger Bands: 
  Upper: ${technicalData.bollingerBands.upper}
  Middle: ${technicalData.bollingerBands.middle}
  Lower: ${technicalData.bollingerBands.lower}

Volume Analysis:
- Current Volume: ${recentData[0].volume}
- Average Volume: ${technicalData.volume.average}
- Volume Trend: ${recentData[0].volume > technicalData.volume.average ? 'Above Average' : 'Below Average'}

Price Action:
- 10-day High: $${high}
- 10-day Low: $${low}
- Volatility: ${volatility}%

Breakout Analysis:
- Direction: ${technicalData.breakout.direction}
- Probability: ${technicalData.breakout.probability}%
- Support Level: $${low}
- Resistance Level: $${high}

Please provide a detailed analysis including:

1. Market Sentiment:
   - Overall sentiment (BULLISH/BEARISH/NEUTRAL)
   - Confidence level (0-100%)
   - Technical sentiment
   - Market sentiment
   - Volatility sentiment
   - Momentum sentiment

2. Sentiment Analysis:
   - Price action interpretation
   - Volume analysis
   - Momentum analysis
   - Market context

3. Risk Assessment:
   - Volatility risk
   - Price action risk
   - Volume risk
   - Sentiment-based position sizing

4. Trade Setup:
   - Entry points with sentiment confirmation
   - Stop loss levels adjusted for sentiment
   - Take profit targets
   - Position size recommendations

5. Key Levels:
   - Support/Resistance
   - Breakout points
   - Sentiment pivot points
`;
  }

  processAIResponse(aiResponse, technicalData) {
    // Extract sentiment and confidence
    const sentimentMatch = aiResponse.match(/Overall sentiment:?\s*(BULLISH|BEARISH|NEUTRAL)/i);
    const confidenceMatch = aiResponse.match(/Confidence level:?\s*(\d+)/i);
    
    const sentiment = {
      overall: sentimentMatch?.[1].toUpperCase() || 'NEUTRAL',
      confidence: parseInt(confidenceMatch?.[1] || technicalData.breakout.probability),
      factors: {
        technical: this.extractSentimentFactor(aiResponse, 'technical'),
        market: this.extractSentimentFactor(aiResponse, 'market'),
        volatility: this.extractSentimentFactor(aiResponse, 'volatility'),
        momentum: this.extractSentimentFactor(aiResponse, 'momentum')
      },
      analysis: {
        price_action: this.extractAnalysis(aiResponse, 'price action'),
        volume_analysis: this.extractAnalysis(aiResponse, 'volume'),
        momentum_analysis: this.extractAnalysis(aiResponse, 'momentum'),
        market_context: this.extractAnalysis(aiResponse, 'market context')
      }
    };
    
    // Extract risk levels
    const volatilityRisk = (aiResponse.match(/volatility risk.*?(HIGH|MEDIUM|LOW)/i)?.[1] || 'MEDIUM').toUpperCase();
    const priceActionRisk = (aiResponse.match(/price action risk.*?(HIGH|MEDIUM|LOW)/i)?.[1] || 'MEDIUM').toUpperCase();
    const volumeRisk = (aiResponse.match(/volume risk.*?(HIGH|MEDIUM|LOW)/i)?.[1] || 'MEDIUM').toUpperCase();
    
    // Get current price
    const currentPrice = technicalData.current?.close || 
                        technicalData.marketData?.[0]?.close || 
                        200; // Fallback price
    
    // Generate trade setup based on sentiment
    const direction = sentiment.overall === 'BULLISH' ? 'LONG' : 
                     sentiment.overall === 'BEARISH' ? 'SHORT' : 'NEUTRAL';
    
    const tradeSetup = this.generateTradeSetup(currentPrice, technicalData, direction);
    
    // Adjust position size based on sentiment confidence
    const positionSizeModifier = (sentiment.confidence / 100) * 0.5 + 0.5; // Range: 0.5 to 1.0
    
    return {
      sentiment,
      score: {
        total: sentiment.confidence,
        technical: Math.round(sentiment.confidence * 0.4),
        volume: Math.round(sentiment.confidence * 0.3),
        momentum: Math.round(sentiment.confidence * 0.3)
      },
      signals: {
        primary: sentiment.overall,
        secondary: Object.entries(sentiment.factors)
          .filter(([_, value]) => value !== sentiment.overall)
          .map(([factor, value]) => ({ factor, value })),
        confidence: sentiment.confidence
      },
      analysis: {
        summary: aiResponse,
        technical: technicalData,
        breakoutContext: {
          direction: technicalData.breakout.direction,
          strength: this.calculateStrength(sentiment.confidence),
          riskProfile: {
            volatility: volatilityRisk,
            priceAction: priceActionRisk,
            volume: volumeRisk,
            overall: this.calculateOverallRisk(volatilityRisk, priceActionRisk, volumeRisk)
          }
        },
        sentiment: sentiment.analysis,
        tradeSetup: {
          ...tradeSetup,
          position_size_modifier: positionSizeModifier,
          sentiment_adjustments: {
            stop_loss: this.adjustStopLoss(tradeSetup.stopLoss, sentiment),
            entry_points: this.adjustEntryPoints(tradeSetup.entry, sentiment)
          }
        }
      }
    };
  }

  extractSentimentFactor(response, factor) {
    const match = response.match(new RegExp(`${factor}\\s+sentiment:?\\s*(BULLISH|BEARISH|NEUTRAL)`, 'i'));
    return match?.[1].toUpperCase() || 'NEUTRAL';
  }

  extractAnalysis(response, section) {
    const regex = new RegExp(`${section}[^.]*?([^\\n]+)`, 'i');
    const match = response.match(regex);
    return match?.[1].trim() || 'No analysis available';
  }

  adjustStopLoss(baseStopLoss, sentiment) {
    const adjustmentFactor = (sentiment.confidence / 100) * 0.2 + 0.9; // Range: 0.9 to 1.1
    return {
      price: baseStopLoss * adjustmentFactor,
      adjustment_factor: adjustmentFactor,
      reasoning: `Stop loss ${adjustmentFactor > 1 ? 'widened' : 'tightened'} based on ${sentiment.confidence}% sentiment confidence`
    };
  }

  adjustEntryPoints(baseEntry, sentiment) {
    const adjustmentFactor = (sentiment.confidence / 100) * 0.1 + 0.95; // Range: 0.95 to 1.05
    return {
      price: baseEntry * adjustmentFactor,
      adjustment_factor: adjustmentFactor,
      conditions: [
        `Confirm ${sentiment.overall.toLowerCase()} sentiment before entry`,
        `Volume above ${sentiment.factors.volume === 'BULLISH' ? '150%' : '120%'} average`,
        `Wait for price action confirmation`
      ]
    };
  }

  generateTradeSetup(currentPrice, technicalData, direction) {
    // Default risk percentage for position sizing
    const riskPercentage = 0.02; // 2% risk per trade
    
    // Get ATR for volatility-based stops
    const atr = technicalData.atr?.value || 0;
    
    // Calculate stop loss distance based on ATR
    const stopDistance = Math.max(atr * 1.5, currentPrice * 0.01); // At least 1% of price
    
    // Calculate stop loss and take profit based on direction
    let entry, stopLoss, takeProfit;
    
    if (direction === 'LONG') {
      entry = currentPrice;
      stopLoss = Math.max(entry - stopDistance, entry * 0.95); // Maximum 5% loss
      takeProfit = entry + (entry - stopLoss) * 2; // 2:1 reward-risk ratio
    } else if (direction === 'SHORT') {
      entry = currentPrice;
      stopLoss = Math.min(entry + stopDistance, entry * 1.05); // Maximum 5% loss
      takeProfit = entry - (stopLoss - entry) * 2; // 2:1 reward-risk ratio
    } else {
      // For NEUTRAL direction, provide a two-way setup
      const upEntry = currentPrice * 1.02; // 2% above current price
      const downEntry = currentPrice * 0.98; // 2% below current price
      
      entry = currentPrice;
      stopLoss = downEntry - stopDistance;
      takeProfit = upEntry + stopDistance;
    }
    
    return {
      entry: parseFloat(entry.toFixed(2)),
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit: parseFloat(takeProfit.toFixed(2)),
      riskRewardRatio: parseFloat(((Math.abs(takeProfit - entry) / Math.abs(stopLoss - entry)) || 0).toFixed(2))
    };
  }

  calculateStrength(confidence) {
    if (confidence >= 80) return 'STRONG';
    if (confidence >= 60) return 'MODERATE';
    if (confidence >= 40) return 'WEAK';
    return 'UNCERTAIN';
  }

  calculateOverallRisk(volatilityRisk, priceActionRisk, volumeRisk) {
    const riskMap = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const avgRisk = (riskMap[volatilityRisk] + riskMap[priceActionRisk] + riskMap[volumeRisk]) / 3;
    if (avgRisk >= 2.5) return 'HIGH';
    if (avgRisk >= 1.5) return 'MEDIUM';
    return 'LOW';
  }

  generateFallbackAnalysis(marketData, technicalData) {
    const direction = technicalData.breakout.direction;
    const probability = technicalData.breakout.probability;
    const recentData = marketData.slice(0, 10);
    const latestPrice = recentData[0].close;
    
    // Calculate basic support and resistance
    const high = Math.max(...recentData.map(d => d.high));
    const low = Math.min(...recentData.map(d => d.low));
    
    // Generate fallback trade setup
    const stopLoss = direction === 'LONG' ? low : high;
    const takeProfit = direction === 'LONG' ? 
      latestPrice + (latestPrice - stopLoss) * 1.5 : // 1.5 risk-reward for long
      latestPrice - (stopLoss - latestPrice) * 1.5;  // 1.5 risk-reward for short
    
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
        summary: `Fallback analysis generated due to AI service unavailability. 
${direction} setup detected with ${probability}% confidence based on technical indicators.
Support level at $${low.toFixed(2)}
Resistance level at $${high.toFixed(2)}`,
        technical: technicalData,
        breakoutContext: {
          direction: direction,
          strength: this.calculateStrength(probability),
          riskProfile: {
            volatility: 'MEDIUM',
            priceAction: 'MEDIUM',
            volume: 'MEDIUM',
            overall: 'MEDIUM'
          }
        },
        tradeSetup: {
          entry: latestPrice,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          riskRewardRatio: this.calculateRiskReward(latestPrice, stopLoss, takeProfit)
        }
      }
    };
  }

  calculateRiskReward(entry, stopLoss, takeProfit) {
    if (!entry || !stopLoss || !takeProfit) return null;
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);
    return (reward / risk).toFixed(2);
  }
}
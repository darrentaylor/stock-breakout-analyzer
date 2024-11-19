import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';

export class AnthropicAnalyzer {
    constructor(apiKey) {
        this.anthropic = new Anthropic({ apiKey });
    }

    async analyzeStock(symbol, marketData, technicalData) {
        try {
            console.log('Requesting Anthropic analysis...');
            const prompt = this.constructPrompt(symbol, marketData, technicalData);
            
            const response = await this.anthropic.messages.create({
                model: "claude-3-sonnet-20240229",
                max_tokens: 1000,
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7
            });

            // Extract the content from the response
            const analysis = response.content[0].text;
            console.log('Anthropic Analysis Response:', analysis); // Debug log
            
            // Process the response
            const result = this.processAIResponse(analysis, technicalData);
            console.log('Processed Analysis:', JSON.stringify(result, null, 2)); // Debug log
            
            return result;

        } catch (error) {
            console.error('Anthropic analysis failed:', error.message);
            logger.error('Anthropic Analysis Error:', error);
            
            // Return a default response structure
            return {
                score: {
                    total: technicalData.breakout.probability,
                    technical: Math.round(technicalData.breakout.probability * 0.4),
                    volume: Math.round(technicalData.breakout.probability * 0.3),
                    momentum: Math.round(technicalData.breakout.probability * 0.3)
                },
                signals: {
                    primary: 'NEUTRAL',
                    secondary: [],
                    confidence: technicalData.breakout.probability
                },
                analysis: {
                    summary: 'Analysis failed. Using technical indicators only.',
                    technical: technicalData,
                    breakoutContext: {
                        direction: technicalData.breakout.direction,
                        strength: 'MEDIUM',
                        support: technicalData.bollingerBands.lower,
                        resistance: technicalData.bollingerBands.upper
                    }
                }
            };
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
- RSI (14): ${technicalData.rsi}
- MACD: ${technicalData.macd.histogram}
- Bollinger Bands: 
  Upper: $${technicalData.bollingerBands.upper.toFixed(2)}
  Middle: $${technicalData.bollingerBands.middle.toFixed(2)}
  Lower: $${technicalData.bollingerBands.lower.toFixed(2)}

Advanced Indicators:
- ATR (14): ${technicalData.atr.value.toFixed(4)}
  Volatility: ${technicalData.atr.volatility}
  Risk Level: ${technicalData.atr.risk_level}

- MFI (14): ${technicalData.mfi.value.toFixed(2)}
  Signal: ${technicalData.mfi.signal}
  Institutional Activity: ${technicalData.mfi.institutional_activity.type} (${technicalData.mfi.institutional_activity.intensity} intensity)

Fibonacci Levels:
${Object.entries(technicalData.fibonacci.levels)
    .map(([level, price]) => `  ${level}: $${price.toFixed(2)}`)
    .join('\n')}
Nearest Fib Level: ${technicalData.fibonacci.nearest.level} at $${technicalData.fibonacci.nearest.price.toFixed(2)}

Volume Analysis:
- Current Volume: ${recentData[0].volume.toLocaleString()}
- Average Volume: ${technicalData.volume.averages.twentyDay.toLocaleString()}
- Volume Trend: ${technicalData.volume.trend}

Breakout Analysis:
- Direction: ${technicalData.breakout.direction}
- Probability: ${technicalData.breakout.probability}%
- Risk Level: ${technicalData.atr.risk_level}

Please provide:
1. Overall market sentiment (BULLISH/BEARISH/NEUTRAL)
2. Confidence level (0-100%)
3. Key factors supporting your analysis
4. Risk assessment based on ATR and MFI
5. Price targets using Fibonacci levels
6. Trading recommendations with precise entry/exit points
`;
    }

    processAIResponse(aiResponse, technicalData) {
        try {
            // Extract sentiment and confidence from AI response
            const sentiment = aiResponse.match(/SENTIMENT:?\s*(BULLISH|BEARISH|NEUTRAL)/i)?.[1] || 'NEUTRAL';
            const confidence = parseInt(aiResponse.match(/CONFIDENCE:?\s*(\d+)/i)?.[1] || technicalData.breakout.probability);
            
            // Extract secondary signals
            const secondarySignals = this.extractSecondarySignals(aiResponse);
            
            return {
                score: {
                    total: confidence,
                    technical: Math.round(confidence * 0.4),
                    volume: Math.round(confidence * 0.3),
                    momentum: Math.round(confidence * 0.3)
                },
                signals: {
                    primary: sentiment,
                    secondary: secondarySignals,
                    confidence: confidence
                },
                analysis: {
                    summary: aiResponse,
                    technical: technicalData,
                    breakoutContext: this.extractBreakoutContext(aiResponse, technicalData)
                }
            };
        } catch (error) {
            console.error('Error processing AI response:', error);
            // Return a default structure if processing fails
            return {
                score: {
                    total: technicalData.breakout.probability,
                    technical: Math.round(technicalData.breakout.probability * 0.4),
                    volume: Math.round(technicalData.breakout.probability * 0.3),
                    momentum: Math.round(technicalData.breakout.probability * 0.3)
                },
                signals: {
                    primary: 'NEUTRAL',
                    secondary: [],
                    confidence: technicalData.breakout.probability
                },
                analysis: {
                    summary: aiResponse,
                    technical: technicalData,
                    breakoutContext: {
                        direction: technicalData.breakout.direction,
                        strength: 'MEDIUM',
                        support: technicalData.bollingerBands.lower,
                        resistance: technicalData.bollingerBands.upper
                    }
                }
            };
        }
    }

    extractSecondarySignals(aiResponse) {
        const signals = [];
        
        // Extract key factors and risks
        const keyFactors = aiResponse.match(/KEY FACTORS:(.*?)(?=RISKS:|$)/s)?.[1];
        const risks = aiResponse.match(/RISKS:(.*?)(?=PRICE TARGETS:|$)/s)?.[1];
        
        if (keyFactors) {
            const factors = keyFactors.split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.trim().substring(1).trim());
            signals.push(...factors);
        }
        
        if (risks) {
            const riskFactors = risks.split('\n')
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.trim().substring(1).trim());
            signals.push(...riskFactors);
        }
        
        return signals.slice(0, 5); // Return top 5 signals
    }

    extractBreakoutContext(aiResponse, technicalData) {
        // Extract price targets
        const priceTargets = aiResponse.match(/PRICE TARGETS:(.*?)(?=RECOMMENDATION:|$)/s)?.[1] || '';
        const supportMatch = priceTargets.match(/support.*?\$?([\d.]+)/i);
        const resistanceMatch = priceTargets.match(/resistance.*?\$?([\d.]+)/i);
        
        return {
            direction: technicalData.breakout.direction,
            strength: technicalData.breakout.probability > 70 ? 'STRONG' : 
                     technicalData.breakout.probability > 50 ? 'MEDIUM' : 'WEAK',
            support: supportMatch ? parseFloat(supportMatch[1]) : technicalData.bollingerBands.lower,
            resistance: resistanceMatch ? parseFloat(resistanceMatch[1]) : technicalData.bollingerBands.upper
        };
    }
}

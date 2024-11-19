import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import { PerplexityAnalyzer } from './PerplexityAnalyzer.js';

class AnthropicAnalyzer {
    constructor(apiKey, perplexityApiKey) {
        this.apiKey = apiKey;
        this.anthropic = new Anthropic({ apiKey });
        this.perplexityAnalyzer = new PerplexityAnalyzer(perplexityApiKey);
    }

    safelyFormatNumber(number) {
        if (number === null || number === undefined) return 'N/A';
        return typeof number === 'number' ? number.toFixed(2) : number;
    }

    constructPrompt(data) {
        const marketData = data.marketData;
        const technicalData = data.technicalData;
        const marketContext = data.marketContext;
        
        return `As an expert trading analyst, analyze this market data and real-time market context to provide comprehensive trading recommendations. Pay special attention to:
1. Technical Analysis: price patterns, indicators, and Bollinger Bands squeeze conditions
2. Real-time Market Context: current news, sentiment, industry trends, and potential catalysts/risks
3. Sentiment Integration: combine technical signals with real-time market sentiment

Return ONLY a JSON object with the following structure, no other text:
{
    "sentiment": {
        "overall": "BULLISH" | "BEARISH" | "NEUTRAL",
        "confidence": <number 0-100>,
        "factors": {
            "technical": "BULLISH" | "BEARISH" | "NEUTRAL",
            "market": "BULLISH" | "BEARISH" | "NEUTRAL",
            "volatility": "BULLISH" | "BEARISH" | "NEUTRAL",
            "momentum": "BULLISH" | "BEARISH" | "NEUTRAL"
        },
        "analysis": {
            "price_action": "<description of price action sentiment>",
            "volume_analysis": "<description of volume sentiment>",
            "momentum_analysis": "<description of momentum sentiment>",
            "market_context": "<broader market sentiment analysis incorporating real-time news and events>"
        }
    },
    "analysis": {
        "technical_factors": [
            {
                "indicator": "<indicator name>",
                "signal": "BULLISH" | "BEARISH" | "NEUTRAL",
                "strength": "STRONG" | "MODERATE" | "WEAK",
                "description": "<specific insight>"
            }
        ],
        "breakout_analysis": {
            "pattern": "<pattern type>",
            "confirmation": true | false,
            "target_price": <number>,
            "key_levels": {
                "breakout_level": <number>,
                "support": <number>,
                "resistance": <number>
            }
        },
        "volatility_analysis": {
            "bollinger_squeeze": {
                "active": true | false,
                "strength": "STRONG" | "MODERATE" | "WEAK",
                "duration": <number>,
                "bandwidth_trend": "EXPANDING" | "CONTRACTING"
            },
            "atr_trend": "INCREASING" | "DECREASING",
            "volatility_state": "HIGH" | "MEDIUM" | "LOW"
        },
        "risk_assessment": {
            "overall": "LOW" | "MEDIUM" | "HIGH",
            "volatility": "LOW" | "MEDIUM" | "HIGH",
            "market_condition": "TRENDING" | "RANGING" | "VOLATILE",
            "risk_factors": [
                {
                    "factor": "<risk factor>",
                    "impact": "HIGH" | "MEDIUM" | "LOW",
                    "mitigation": "<mitigation strategy>"
                }
            ]
        }
    },
    "trade_recommendation": {
        "action": "BUY" | "SELL" | "HOLD",
        "type": "BREAKOUT" | "TREND_FOLLOWING" | "REVERSAL" | "RANGE_BOUND",
        "timeframe": "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM",
        "entry": {
            "price": <number>,
            "condition": "<entry condition>",
            "urgency": "IMMEDIATE" | "WAIT_FOR_PULLBACK" | "LIMIT_ORDER"
        },
        "exits": {
            "stop_loss": {
                "price": <number>,
                "type": "FIXED" | "TRAILING" | "ATR_BASED",
                "reasoning": "<stop loss explanation>"
            },
            "take_profit": {
                "price": <number>,
                "type": "FIXED" | "SCALED" | "TRAILING",
                "targets": [
                    {
                        "price": <number>,
                        "size": "<percentage of position>"
                    }
                ]
            }
        },
        "position_sizing": {
            "risk_percentage": <number>,
            "leverage": <number if applicable>,
            "max_position_size": "<percentage of portfolio>"
        }
    },
    "execution_strategy": {
        "entry_approach": "<how to enter the trade>",
        "exit_management": "<how to manage exits>",
        "risk_management": "<specific risk management instructions>",
        "key_warnings": [
            "<important watch-outs>"
        ],
        "sentiment_based_adjustments": {
            "position_size_modifier": <number between 0.5 and 1.5>,
            "stop_loss_adjustment": "<adjustment based on sentiment>",
            "entry_conditions": ["<additional conditions based on sentiment>"]
        }
    }
}

Market Data (last 5 days):
${JSON.stringify(marketData.slice(0, 5), null, 2)}

Technical Indicators:
${JSON.stringify(technicalData, null, 2)}

Real-time Market Context:
${JSON.stringify(marketContext, null, 2)}

Analyze both the technical data and real-time market context to provide comprehensive trading recommendations. Consider how current news, sentiment, and market conditions affect the technical signals.`;
    }

    async analyze(data) {
        try {
            // First get real-time market context from Perplexity
            const marketContext = await this.perplexityAnalyzer.getMarketContext(data.symbol);
            
            // Enhance the prompt with real-time market context
            const prompt = this.constructPrompt({
                ...data,
                marketContext // Add market context to the data
            });
            
            const response = await this.anthropic.messages.create({
                model: "claude-3-5-sonnet-latest",
                max_tokens: 1500,
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7,
                system: "You are an expert trading analyst specializing in market sentiment analysis and technical breakout patterns. Analyze both technical indicators and real-time market context to provide comprehensive trading recommendations."
            });

            let analysis = response.content[0].text;
            
            // Try to extract JSON if it's wrapped in other text
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = jsonMatch[0];
            }

            let parsedAnalysis;
            try {
                parsedAnalysis = JSON.parse(analysis);
                
                // Enhance sentiment-based adjustments
                parsedAnalysis.execution_strategy = {
                    ...parsedAnalysis.execution_strategy,
                    sentiment_based_adjustments: this.calculateSentimentAdjustments(parsedAnalysis.sentiment)
                };

                // Add market data for display purposes
                parsedAnalysis.marketData = data.marketData;
                
                // Add real-time context
                parsedAnalysis.real_time_context = marketContext;

                return parsedAnalysis;
            } catch (e) {
                console.warn('Failed to parse Anthropic response as JSON:', e);
                // Provide a default structured response
                return {
                    sentiment: {
                        overall: "NEUTRAL",
                        confidence: 50,
                        factors: {
                            technical: "NEUTRAL",
                            market: "NEUTRAL",
                            volatility: "NEUTRAL",
                            momentum: "NEUTRAL"
                        },
                        analysis: {
                            price_action: "Default analysis due to parsing error",
                            volume_analysis: "Volume analysis unavailable",
                            momentum_analysis: "Momentum analysis unavailable",
                            market_context: "Market context unavailable"
                        }
                    },
                    analysis: {
                        technical_factors: [],
                        risk_assessment: {
                            overall: "MEDIUM",
                            volatility: "MEDIUM",
                            market_condition: "RANGING",
                            risk_factors: [{
                                factor: "Analysis Error",
                                impact: "HIGH",
                                mitigation: "Manual review required"
                            }]
                        },
                        volatility_analysis: {
                            bollinger_squeeze: {
                                active: false,
                                strength: "WEAK",
                                duration: 0,
                                bandwidth_trend: "NEUTRAL"
                            },
                            atr_trend: "NEUTRAL",
                            volatility_state: "MEDIUM"
                        }
                    },
                    trade_recommendation: {
                        action: "HOLD",
                        type: "BREAKOUT",
                        timeframe: "SHORT_TERM",
                        entry: {
                            price: data.marketData[0].close,
                            condition: "Analysis failed - manual review required",
                            urgency: "WAIT_FOR_PULLBACK"
                        },
                        exits: {
                            stop_loss: {
                                price: data.marketData[0].low,
                                type: "FIXED",
                                reasoning: "Using technical default"
                            },
                            take_profit: {
                                price: data.marketData[0].high,
                                type: "FIXED",
                                targets: []
                            }
                        },
                        position_sizing: {
                            risk_percentage: 1,
                            leverage: 1,
                            max_position_size: "1%"
                        }
                    },
                    execution_strategy: {
                        entry_approach: "Wait for manual analysis",
                        exit_management: "Use conservative exits",
                        risk_management: "Reduce position size due to analysis uncertainty",
                        key_warnings: ["Analysis may be incomplete due to parsing error"],
                        sentiment_based_adjustments: {
                            position_size_modifier: 0.5,
                            stop_loss_adjustment: "Tighter stops recommended",
                            entry_conditions: ["Wait for clear sentiment signals"]
                        }
                    },
                    marketData: data.marketData,
                    real_time_context: marketContext
                };
            }
        } catch (error) {
            console.error('Error in Anthropic analysis:', error);
            throw error;
        }
    }

    async displayAnalysis(analysis) {
        if (!analysis || !analysis.sentiment) {
            console.log('\n❌ Error: Invalid analysis data');
            return;
        }

        console.log('\n🎯 MARKET ANALYSIS REPORT');
        console.log('═══════════════════════════════════════════');

        // Real-time Market Context Section
        if (analysis.real_time_context) {
            console.log('\n🔄 REAL-TIME MARKET CONTEXT');
            console.log('───────────────────────────────────────');
            
            // Current News
            if (analysis.real_time_context.current_news?.length > 0) {
                console.log('\nRecent News:');
                analysis.real_time_context.current_news.forEach(news => {
                    const impactEmoji = {
                        'POSITIVE': '📈',
                        'NEGATIVE': '📉',
                        'NEUTRAL': '➖'
                    }[news.impact];
                    console.log(`${impactEmoji} ${news.headline}`);
                    console.log(`   Impact: ${news.impact} (${news.significance})`);
                    console.log(`   ${news.summary}`);
                });
            }

            // Market Sentiment
            const sentiment = analysis.real_time_context.market_sentiment;
            console.log('\nCurrent Market Sentiment:');
            console.log(`${this.getSentimentEmoji(sentiment.overall)} ${sentiment.overall} (${sentiment.confidence}% confidence)`);
            if (sentiment.key_factors?.length > 0) {
                console.log('Key Factors:');
                sentiment.key_factors.forEach(factor => console.log(`- ${factor}`));
            }

            // Industry Analysis
            const industry = analysis.real_time_context.industry_analysis;
            console.log('\nIndustry Analysis:');
            console.log(`Trend: ${industry.trend}`);
            if (industry.key_developments?.length > 0) {
                console.log('Key Developments:');
                industry.key_developments.forEach(dev => console.log(`- ${dev}`));
            }

            // Catalysts and Risks
            const catalysts = analysis.real_time_context.catalysts_and_risks;
            console.log('\nCatalysts and Risks:');
            if (catalysts.upcoming_catalysts?.length > 0) {
                console.log('Upcoming Catalysts:');
                catalysts.upcoming_catalysts.forEach(catalyst => console.log(`📅 ${catalyst}`));
            }
            if (catalysts.potential_risks?.length > 0) {
                console.log('Potential Risks:');
                catalysts.potential_risks.forEach(risk => console.log(`⚠️ ${risk}`));
            }
        }

        // Sentiment Analysis Section
        console.log('\n📊 SENTIMENT ANALYSIS');
        console.log('───────────────────────────────────────');
        console.log(`Overall Sentiment: ${this.getSentimentEmoji(analysis.sentiment.overall)} ${analysis.sentiment.overall}`);
        console.log(`Confidence: ${analysis.sentiment.confidence}%`);
        
        if (analysis.sentiment.factors) {
            console.log('\nSentiment Factors:');
            Object.entries(analysis.sentiment.factors).forEach(([factor, value]) => {
                console.log(`- ${factor.charAt(0).toUpperCase() + factor.slice(1)}: ${this.getSentimentEmoji(value)} ${value}`);
            });
        }

        if (analysis.sentiment.analysis) {
            console.log('\nDetailed Analysis:');
            Object.entries(analysis.sentiment.analysis).forEach(([aspect, detail]) => {
                if (detail && detail !== 'No analysis available') {
                    console.log(`- ${aspect.replace(/_/g, ' ').charAt(0).toUpperCase() + aspect.slice(1).replace(/_/g, ' ')}:`);
                    console.log(`  ${detail}`);
                }
            });
        }

        // Technical Analysis Section
        if (analysis.analysis) {
            console.log('\n📈 TECHNICAL ANALYSIS');
            console.log('───────────────────────────────────────');
            
            // Bollinger Bands Analysis
            if (analysis.analysis.volatility_analysis?.bollinger_squeeze) {
                const squeeze = analysis.analysis.volatility_analysis.bollinger_squeeze;
                console.log('\nBollinger Bands Squeeze:');
                console.log(`Status: ${squeeze.active ? '🔄 Active' : '✨ Inactive'}`);
                console.log(`Strength: ${squeeze.strength}`);
                console.log(`Duration: ${squeeze.duration} periods`);
                console.log(`Bandwidth Trend: ${squeeze.bandwidth_trend}`);
            }

            // Risk Assessment
            if (analysis.analysis.risk_assessment) {
                console.log('\n⚠️ RISK ASSESSMENT');
                console.log('───────────────────────────────────────');
                const risk = analysis.analysis.risk_assessment;
                console.log(`Overall Risk: ${this.getRiskEmoji(risk.overall)} ${risk.overall}`);
                console.log(`Market Condition: ${risk.market_condition}`);
                
                if (risk.risk_factors?.length > 0) {
                    console.log('\nRisk Factors:');
                    risk.risk_factors.forEach(factor => {
                        console.log(`- ${factor.factor}: ${this.getRiskEmoji(factor.impact)} ${factor.impact}`);
                        if (factor.mitigation) {
                            console.log(`  Mitigation: ${factor.mitigation}`);
                        }
                    });
                }
            }
        }

        // Trade Recommendation
        if (analysis.trade_recommendation) {
            console.log('\n💡 TRADE RECOMMENDATION');
            console.log('───────────────────────────────────────');
            const trade = analysis.trade_recommendation;
            console.log(`Action: ${this.getActionEmoji(trade.action)} ${trade.action}`);
            console.log(`Type: ${trade.type}`);
            console.log(`Timeframe: ${trade.timeframe}`);
            
            // Entry Strategy
            if (trade.entry) {
                console.log('\nEntry Strategy:');
                console.log(`Price: $${trade.entry.price}`);
                console.log(`Condition: ${trade.entry.condition}`);
                console.log(`Urgency: ${trade.entry.urgency}`);
            }

            // Position Sizing
            if (trade.position_sizing) {
                console.log('\nPosition Sizing:');
                console.log(`Base Risk: ${trade.position_sizing.risk_percentage}%`);
                if (analysis.execution_strategy?.sentiment_based_adjustments?.position_size_modifier) {
                    console.log(`Sentiment Modifier: ${analysis.execution_strategy.sentiment_based_adjustments.position_size_modifier.toFixed(2)}x`);
                }
                console.log(`Max Position Size: ${trade.position_sizing.max_position_size}`);
            }

            // Exit Strategy
            if (trade.exits) {
                console.log('\nExit Strategy:');
                if (trade.exits.stop_loss) {
                    console.log(`Stop Loss: $${trade.exits.stop_loss.price} (${trade.exits.stop_loss.type})`);
                }
                if (trade.exits.take_profit?.targets?.length > 0) {
                    console.log('Take Profit Targets:');
                    trade.exits.take_profit.targets.forEach((target, i) => {
                        console.log(`  ${i + 1}. $${target.price} (${target.size})`);
                    });
                } else if (trade.exits.take_profit?.price) {
                    console.log(`Take Profit: $${trade.exits.take_profit.price}`);
                }
            }
        }

        // Execution Strategy
        if (analysis.execution_strategy) {
            console.log('\n📋 EXECUTION STRATEGY');
            console.log('───────────────────────────────────────');
            const exec = analysis.execution_strategy;
            
            if (exec.entry_approach) console.log(`Entry: ${exec.entry_approach}`);
            if (exec.exit_management) console.log(`Exit: ${exec.exit_management}`);
            if (exec.risk_management) console.log(`Risk: ${exec.risk_management}`);
            
            if (exec.sentiment_based_adjustments) {
                console.log('\nSentiment Adjustments:');
                const adj = exec.sentiment_based_adjustments;
                if (adj.position_size_modifier) console.log(`Position Size: ${adj.position_size_modifier}x`);
                if (adj.stop_loss_adjustment) console.log(`Stop Loss: ${adj.stop_loss_adjustment}`);
                if (adj.entry_conditions?.length > 0) {
                    console.log('Entry Conditions:');
                    adj.entry_conditions.forEach(cond => console.log(`- ${cond}`));
                }
            }

            if (exec.key_warnings?.length > 0) {
                console.log('\n⚠️ Key Warnings:');
                exec.key_warnings.forEach(warning => console.log(`- ${warning}`));
            }
        }

        console.log('\n═══════════════════════════════════════════\n');
    }

    getSentimentEmoji(sentiment) {
        const emojis = {
            'BULLISH': '🟢',
            'BEARISH': '🔴',
            'NEUTRAL': '🟡'
        };
        return emojis[sentiment] || '⚪';
    }

    getRiskEmoji(risk) {
        const emojis = {
            'HIGH': '🔴',
            'MEDIUM': '🟡',
            'LOW': '🟢'
        };
        return emojis[risk] || '⚪';
    }

    getActionEmoji(action) {
        const emojis = {
            'BUY': '💰',
            'SELL': '💸',
            'HOLD': '⏳'
        };
        return emojis[action] || '⚪';
    }

    calculateSentimentAdjustments(sentiment) {
        const confidenceModifier = sentiment.confidence / 100;
        const basePositionSize = 1.0;
        
        // Calculate position size modifier based on sentiment confidence and alignment
        let positionSizeModifier = basePositionSize * confidenceModifier;
        
        // Adjust stop loss based on sentiment volatility
        const stopLossAdjustment = sentiment.factors.volatility === "HIGH" ? "TIGHTER" :
                                  sentiment.factors.volatility === "LOW" ? "WIDER" : "STANDARD";
        
        // Define entry conditions based on sentiment factors
        const entryConditions = [];
        
        if (sentiment.factors.technical === sentiment.factors.market) {
            entryConditions.push("ALIGNED_SENTIMENT");
            positionSizeModifier *= 1.2; // Increase position size for aligned signals
        } else {
            entryConditions.push("CONFLICTING_SENTIMENT");
            positionSizeModifier *= 0.8; // Reduce position size for conflicting signals
        }
        
        if (sentiment.factors.momentum === "BULLISH") {
            entryConditions.push("STRONG_MOMENTUM");
        }
        
        return {
            position_size_modifier: parseFloat(positionSizeModifier.toFixed(2)),
            stop_loss_adjustment: stopLossAdjustment,
            entry_conditions: entryConditions,
            confidence_level: sentiment.confidence,
            market_alignment: sentiment.factors.technical === sentiment.factors.market ? "ALIGNED" : "DIVERGENT"
        };
    }
}

export { AnthropicAnalyzer };

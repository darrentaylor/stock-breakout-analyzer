import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';

class AnthropicAnalyzer {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.anthropic = new Anthropic({ apiKey });
    }

    safelyFormatNumber(number) {
        if (number === null || number === undefined) return 'N/A';
        return typeof number === 'number' ? number.toFixed(2) : number;
    }

    constructPrompt(data) {
        const marketData = data.marketData;
        const technicalData = data.technicalData;
        
        return `As an expert trading analyst, analyze this market data with special attention to Bollinger Bands squeeze conditions and potential breakouts. Focus on technical analysis, breakout patterns, and clear entry/exit points. Return ONLY a JSON object with the following structure, no other text:
{
    "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
    "confidence": <number 0-100>,
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
        ]
    }
}

Market Data (last 5 days):
${JSON.stringify(marketData.slice(0, 5), null, 2)}

Technical Indicators:
${JSON.stringify(technicalData, null, 2)}

Provide a comprehensive analysis with specific, actionable trade recommendations based on technical analysis, breakout patterns, and risk management principles. Pay special attention to Bollinger Bands squeeze conditions as potential breakout setups.`;
    }

    async analyze(data) {
        try {
            const prompt = this.constructPrompt(data);
            
            const response = await this.anthropic.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1000,
                messages: [{
                    role: "user",
                    content: prompt
                }],
                temperature: 0.7
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
                // Add market data for display purposes
                parsedAnalysis.marketData = data.marketData;
                return parsedAnalysis;
            } catch (e) {
                console.warn('Failed to parse Anthropic response as JSON:', e);
                // Provide a default structured response
                return {
                    sentiment: 'NEUTRAL',
                    confidence: 50,
                    analysis: {
                        technical_factors: [],
                        risk_assessment: {
                            overall: 'MEDIUM',
                            volatility: 'MEDIUM',
                            market_condition: 'TRENDING',
                            risk_factors: []
                        },
                        breakout_analysis: {
                            pattern: '',
                            confirmation: false,
                            target_price: data.marketData[0].close,
                            key_levels: {
                                breakout_level: data.marketData[0].close,
                                support: data.marketData[0].low,
                                resistance: data.marketData[0].high
                            }
                        }
                    },
                    trade_recommendation: {
                        action: 'HOLD',
                        type: 'BREAKOUT',
                        timeframe: 'SHORT_TERM',
                        entry: {
                            price: data.marketData[0].close,
                            condition: 'Wait for confirmation',
                            urgency: 'WAIT_FOR_PULLBACK'
                        },
                        exits: {
                            stop_loss: {
                                price: data.marketData[0].low,
                                type: 'FIXED',
                                reasoning: 'Using recent low as support'
                            },
                            take_profit: {
                                price: data.marketData[0].high,
                                type: 'FIXED',
                                targets: []
                            }
                        },
                        position_sizing: {
                            risk_percentage: 1,
                            leverage: 1,
                            max_position_size: '1%'
                        }
                    },
                    execution_strategy: {
                        entry_approach: 'Wait for price confirmation before entering',
                        exit_management: 'Use fixed stops and targets',
                        risk_management: 'Limit position size to 1% of portfolio',
                        key_warnings: ['Analysis may be incomplete due to parsing error']
                    },
                    marketData: data.marketData
                };
            }
        } catch (error) {
            console.error('Error in Anthropic analysis:', error);
            return {
                sentiment: 'NEUTRAL',
                confidence: 50,
                analysis: {
                    technical_factors: [],
                    risk_assessment: {
                        overall: 'HIGH',
                        volatility: 'HIGH',
                        market_condition: 'VOLATILE',
                        risk_factors: [{
                            factor: 'Analysis Error',
                            impact: 'HIGH',
                            mitigation: 'Manual review required'
                        }]
                    }
                },
                trade_recommendation: {
                    action: 'HOLD',
                    type: 'BREAKOUT',
                    timeframe: 'SHORT_TERM',
                    entry: {
                        price: data.marketData[0].close,
                        condition: 'Analysis failed - manual review required',
                        urgency: 'WAIT_FOR_PULLBACK'
                    },
                    exits: {
                        stop_loss: {
                            price: data.marketData[0].low,
                            type: 'FIXED',
                            reasoning: 'Using technical default'
                        },
                        take_profit: {
                            price: data.marketData[0].high,
                            type: 'FIXED',
                            targets: []
                        }
                    },
                    position_sizing: {
                        risk_percentage: 1,
                        leverage: 1,
                        max_position_size: '1%'
                    }
                },
                execution_strategy: {
                    entry_approach: 'DO NOT ENTER - Analysis failed',
                    exit_management: 'Manual review required',
                    risk_management: 'Avoid trading until analysis is fixed',
                    key_warnings: ['Analysis failed due to API error', error.message]
                },
                marketData: data.marketData
            };
        }
    }

    async displayAnalysis(analysis) {
        console.log('\n🎯 TRADE RECOMMENDATION');
        console.log('═══════════════════════════════\n');

        // Quick Summary Box
        if (analysis.trade_recommendation) {
            const rec = analysis.trade_recommendation;
            console.log('📊 QUICK SUMMARY');
            console.log('──────────────────');
            console.log(`Signal: ${rec.action.padEnd(4)} | Type: ${rec.type}`);
            console.log(`Risk:   ${analysis.analysis?.risk_assessment?.overall.padEnd(4)} | Time: ${rec.timeframe}`);
            console.log(`Confidence: ${analysis.confidence}%`);
            
            // Add Bollinger Squeeze Status
            if (analysis.analysis?.volatility_analysis?.bollinger_squeeze) {
                const squeeze = analysis.analysis.volatility_analysis.bollinger_squeeze;
                const squeezeEmoji = squeeze.active ? '🔄' : '➡️';
                console.log(`Squeeze: ${squeezeEmoji} ${squeeze.active ? 'ACTIVE' : 'INACTIVE'} (${squeeze.strength})`);
            }
            console.log('──────────────────\n');

            // Key Price Levels
            console.log('💰 KEY PRICE LEVELS');
            console.log('──────────────────');
            console.log(`Current Price: $${analysis.marketData?.[0]?.close?.toFixed(2) || 'N/A'}`);
            if (analysis.analysis?.breakout_analysis?.key_levels) {
                const levels = analysis.analysis.breakout_analysis.key_levels;
                console.log(`Breakout Level: $${levels.breakout_level.toFixed(2)}`);
                console.log(`Resistance:     $${levels.resistance.toFixed(2)}`);
                console.log(`Support:       $${levels.support.toFixed(2)}`);
            }
            console.log('──────────────────\n');

            // Volatility Analysis
            if (analysis.analysis?.volatility_analysis) {
                console.log('📈 VOLATILITY ANALYSIS');
                console.log('──────────────────');
                const vol = analysis.analysis.volatility_analysis;
                if (vol.bollinger_squeeze) {
                    console.log('Bollinger Squeeze:');
                    console.log(`• Status:    ${vol.bollinger_squeeze.active ? '🔄 ACTIVE' : '➡️ INACTIVE'}`);
                    console.log(`• Strength:  ${vol.bollinger_squeeze.strength}`);
                    console.log(`• Duration:  ${vol.bollinger_squeeze.duration} periods`);
                    console.log(`• Bandwidth: ${vol.bollinger_squeeze.bandwidth_trend}`);
                }
                console.log(`\nVolatility State: ${vol.volatility_state}`);
                console.log(`ATR Trend:       ${vol.atr_trend}`);
                console.log('──────────────────\n');
            }

            // Trade Setup
            console.log('🎯 TRADE SETUP');
            console.log('──────────────────');
            console.log('Entry Strategy:');
            console.log(`• Price:     $${rec.entry.price.toFixed(2)}`);
            console.log(`• Condition: ${rec.entry.condition}`);
            console.log(`• Timing:    ${rec.entry.urgency}\n`);

            console.log('Risk Management:');
            console.log(`• Stop Loss: $${rec.exits.stop_loss.price.toFixed(2)} (${rec.exits.stop_loss.type})`);
            console.log(`• Risk Size: ${rec.position_sizing.risk_percentage}% of portfolio`);
            if (rec.position_sizing.leverage > 1) {
                console.log(`• Leverage:  ${rec.position_sizing.leverage}x`);
            }
            console.log(`• Max Size:  ${rec.position_sizing.max_position_size}\n`);

            console.log('Profit Targets:');
            if (rec.exits.take_profit.targets.length > 0) {
                rec.exits.take_profit.targets.forEach((target, i) => {
                    console.log(`• TP${i + 1}: $${target.price.toFixed(2)} (${target.size})`);
                });
            } else {
                console.log(`• Target: $${rec.exits.take_profit.price.toFixed(2)}`);
            }
            console.log('──────────────────\n');

            // Technical Analysis Summary
            if (analysis.analysis?.technical_factors?.length > 0) {
                console.log('📈 TECHNICAL SIGNALS');
                console.log('──────────────────');
                analysis.analysis.technical_factors
                    .sort((a, b) => {
                        const strengthOrder = { 'STRONG': 0, 'MODERATE': 1, 'WEAK': 2 };
                        return strengthOrder[a.strength] - strengthOrder[b.strength];
                    })
                    .forEach(factor => {
                        const signal = factor.signal === 'BULLISH' ? '🟢' : 
                                     factor.signal === 'BEARISH' ? '🔴' : '⚪';
                        console.log(`${signal} ${factor.indicator} (${factor.strength})`);
                        console.log(`   ${factor.description}`);
                    });
                console.log('──────────────────\n');
            }

            // Pattern Analysis
            if (analysis.analysis?.breakout_analysis?.pattern) {
                const breakout = analysis.analysis.breakout_analysis;
                console.log('🔄 PATTERN ANALYSIS');
                console.log('──────────────────');
                console.log(`Pattern:      ${breakout.pattern}`);
                console.log(`Confirmation: ${breakout.confirmation ? '✅ Yes' : '❌ No'}`);
                console.log(`Target:       $${breakout.target_price.toFixed(2)}`);
                console.log('──────────────────\n');
            }

            // Risk Factors
            if (analysis.analysis?.risk_assessment?.risk_factors?.length > 0) {
                console.log('⚠️ RISK FACTORS');
                console.log('──────────────────');
                analysis.analysis.risk_assessment.risk_factors
                    .sort((a, b) => {
                        const impactOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
                        return impactOrder[a.impact] - impactOrder[b.impact];
                    })
                    .forEach(risk => {
                        const impact = risk.impact === 'HIGH' ? '🔴' :
                                     risk.impact === 'MEDIUM' ? '🟡' : '🟢';
                        console.log(`${impact} ${risk.factor}`);
                        console.log(`   Mitigation: ${risk.mitigation}`);
                    });
                console.log('──────────────────\n');
            }

            // Trade Management Instructions
            if (analysis.execution_strategy) {
                console.log('📋 EXECUTION GUIDE');
                console.log('──────────────────');
                console.log('1. Entry Strategy:');
                console.log(`   ${analysis.execution_strategy.entry_approach}\n`);
                console.log('2. Exit Management:');
                console.log(`   ${analysis.execution_strategy.exit_management}\n`);
                console.log('3. Risk Management:');
                console.log(`   ${analysis.execution_strategy.risk_management}`);
                
                if (analysis.execution_strategy.key_warnings?.length > 0) {
                    console.log('\nKey Watch-outs:');
                    analysis.execution_strategy.key_warnings.forEach(warning => {
                        console.log(`❗ ${warning}`);
                    });
                }
                console.log('──────────────────');
            }
        }

        console.log('\n═══════════════════════════════\n');
    }
}

export { AnthropicAnalyzer };

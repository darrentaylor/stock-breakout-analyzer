import dotenv from 'dotenv';
import { MarketDataService } from './services/MarketDataService.js';
import { AlphaVantageService } from './services/AlphaVantageService.js';
import { TechnicalAnalysis } from './utils/TechnicalAnalysis.js';
import { AnthropicAnalyzer } from './services/AnthropicAnalyzer.js';
import { StopLossService } from './services/StopLossService.js';
import { RiskManager } from './services/RiskManager.js';
import { PatternRecognitionService } from './services/PatternRecognitionService.js';

dotenv.config();

async function runTradingSystem() {
    console.log('\n═══════════════════════════════════════════');
    console.log('         TRADING SYSTEM ANALYSIS           ');
    console.log('═══════════════════════════════════════════\n');

    const symbols = ['AAPL', 'MSFT', 'TSLA'];
    const alphaVantage = new AlphaVantageService(process.env.ALPHA_VANTAGE_KEY);
    const marketData = new MarketDataService(alphaVantage);
    const technicalAnalysis = new TechnicalAnalysis();
    const anthropic = new AnthropicAnalyzer(process.env.ANTHROPIC_API_KEY, process.env.PERPLEXITY_API_KEY);
    const stopLoss = new StopLossService();
    const riskManager = new RiskManager();
    const patternRecognition = new PatternRecognitionService();

    for (const symbol of symbols) {
        console.log(`\nAnalyzing ${symbol}...`);
        
        try {
            // Fetch both current and historical data
            const [priceData, historicalData] = await Promise.all([
                marketData.fetchPriceData(symbol),
                marketData.getHistoricalData(symbol)
            ]);

            if (!priceData || !historicalData) {
                console.error(`Failed to fetch data for ${symbol}`);
                continue;
            }

            // Technical analysis using historical data
            const technical = await technicalAnalysis.analyze(historicalData);
            
            // Pattern recognition using historical data
            const patterns = await patternRecognition.analyze(historicalData);

            // Calculate stop loss levels using both current and historical data
            const stopLossLevels = stopLoss.calculateLevels({
                current: priceData.current,
                historical: historicalData
            }, technical);

            // Risk assessment
            const riskAssessment = riskManager.assessRisk({
                current: priceData.current,
                historical: historicalData
            }, {
                technical,
                patterns: patterns?.patterns || [],
                trend: technical.trend,
                volatility: technical.volatility
            });

            // Combine all data for AI analysis
            const analysisData = {
                symbol,
                marketData: historicalData,
                technicalData: {
                    ...technical,
                    patterns,
                    stopLoss: stopLossLevels,
                    risk: riskAssessment
                }
            };

            // Run AI analysis using only Anthropic
            const aiAnalysis = await anthropic.analyze(analysisData);

            // Display analysis results
            await anthropic.displayAnalysis(aiAnalysis);

            // Add delay to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`Error analyzing ${symbol}:`, error);
        }
    }
}

async function displayAnalysis(analysis) {
    if (!analysis) {
        console.log('No analysis data available');
        return;
    }

    console.log(`\n▓▓▓▓▓▓▓▓▓▓ ${analysis.symbol} Analysis ▓▓▓▓▓▓▓▓▓▓`);
    console.log(`Time: ${analysis.timestamp}\n`);

    // Price Information
    console.log('📊 Price Information:');
    console.log(`Current: $${analysis.price.current}`);
    console.log(`Previous Close: $${analysis.price.previousClose}`);
    console.log(`Change: ${analysis.price.change}%\n`);

    // Technical Analysis
    console.log('📈 Technical Analysis:');
    if (analysis.technical) {
        console.log(`Trend: ${analysis.technical.trend || 'N/A'}`);
        console.log(`RSI: ${analysis.technical.rsi?.value?.toFixed(2) || 'N/A'}`);
        console.log(`MACD: ${JSON.stringify(analysis.technical.macd || {}, null, 2)}`);
        console.log(`ATR: ${JSON.stringify(analysis.technical.atr || {}, null, 2)}\n`);
    } else {
        console.log('Technical analysis data not available\n');
    }

    // Pattern Analysis
    console.log('🔍 Pattern Analysis:');
    if (analysis.patterns?.patterns) {
        console.log(JSON.stringify(analysis.patterns.patterns, null, 2));
    } else {
        console.log('Pattern analysis data not available');
    }
    console.log();

    // Stop Loss Levels
    console.log('🛑 Stop Loss Levels:');
    if (analysis.stopLoss) {
        console.log(JSON.stringify(analysis.stopLoss, null, 2));
    } else {
        console.log('Stop loss data not available');
    }
    console.log();

    // Risk Assessment
    console.log('⚠️ Risk Assessment:');
    if (analysis.risk) {
        console.log(`Overall Risk: ${analysis.risk.overall}`);
        console.log(`Confidence: ${analysis.risk.confidence}%`);
        console.log('\nRisk Factors:');
        console.log(`- Technical: ${analysis.risk.technical}`);
        console.log(`- Volatility: ${analysis.risk.volatility}`);
        console.log(`- Market: ${analysis.risk.market}`);
    } else {
        console.log('Risk assessment data not available');
    }
    console.log();

    // AI Analysis
    console.log('🤖 AI Analysis:');
    if (analysis.ai) {
        // Anthropic Analysis
        if (analysis.ai.signals) {
            console.log('\nAnthropic Analysis:');
            console.log(`Signal: ${analysis.ai.signals.primary}`);
            console.log(`Confidence: ${analysis.ai.signals.confidence}%`);
            
            if (analysis.ai.analysis) {
                if (analysis.ai.analysis.summary) {
                    console.log('\nSummary:');
                    console.log(analysis.ai.analysis.summary);
                }
                
                if (analysis.ai.analysis.breakoutContext) {
                    const context = analysis.ai.analysis.breakoutContext;
                    console.log('\nBreakout Analysis:');
                    console.log(`Direction: ${context.direction}`);
                    console.log(`Strength: ${context.strength}`);
                    if (context.support) console.log(`Support: $${context.support.toFixed(2)}`);
                    if (context.resistance) console.log(`Resistance: $${context.resistance.toFixed(2)}`);
                }
            }
        } else if (analysis.ai.error) {
            console.log('\nAnthropic Analysis: Error -', analysis.ai.error);
        }
    } else {
        console.log('AI analysis data not available');
    }
    console.log('\n═══════════════════════════════════════════\n');
}

// Run the trading system
runTradingSystem().catch(console.error);

// Add AI debugging
console.log('\nVerifying Anthropic API key...');
console.log('Key exists:', !!process.env.ANTHROPIC_API_KEY);
console.log('Key prefix:', process.env.ANTHROPIC_API_KEY?.substring(0, 3));
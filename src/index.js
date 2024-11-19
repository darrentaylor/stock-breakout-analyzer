import dotenv from 'dotenv';
import { MarketDataAPI } from './services/MarketDataAPI.js';
import { TechnicalAnalysis } from './utils/TechnicalAnalysis.js';
import { OpenAIAnalyzer } from './services/OpenAIAnalyzer.js';
import { AnthropicAnalyzer } from './services/AnthropicAnalyzer.js';

dotenv.config();

async function testConsolidatedAnalysis() {
    console.log('\n═══════════════════════════════════════════');
    console.log('       CONSOLIDATED ANALYSIS TEST           ');
    console.log('═══════════════════════════════════════════\n');

    try {
        // Initialize with environment variables
        const marketDataAPI = new MarketDataAPI(process.env.ALPHA_VANTAGE_KEY);
        const technicalAnalysis = new TechnicalAnalysis();
        const anthropicAnalyzer = new AnthropicAnalyzer(process.env.ANTHROPIC_API_KEY);
        const openaiAnalyzer = new OpenAIAnalyzer(process.env.OPENAI_API_KEY);

        const symbol = 'AAPL';
        console.log(`\nAnalyzing ${symbol}:`);
        console.log('═══════════════════════════════════════════');

        // Get fresh market data
        console.log('Fetching latest market data...');
        const marketData = await marketDataAPI.getMarketData(symbol, true);
        
        // Run technical analysis
        console.log('\nRunning technical analysis...');
        const technicalData = technicalAnalysis.analyze(marketData);
        
        // Get AI insights - try Anthropic first, fallback to OpenAI
        console.log('\nGetting AI insights...');
        let aiAnalysis;
        try {
            aiAnalysis = await anthropicAnalyzer.analyzeStock(symbol, marketData, technicalData);
            console.log('Using Anthropic Analysis');
        } catch (error) {
            console.log('Falling back to OpenAI Analysis');
            aiAnalysis = await openaiAnalyzer.analyzeStock(symbol, marketData, technicalData);
        }

        // Display results
        displayConsolidatedAnalysis({
            symbol,
            marketData,
            analysis: {
                technical: technicalData,
                ...aiAnalysis
            }
        });

    } catch (error) {
        console.error('Test failed:', error);
    }
}

function displayConsolidatedAnalysis(data) {
    console.log('\n═══════════════════════════════════════════');
    console.log('       CONSOLIDATED MARKET ANALYSIS         ');
    console.log('═══════════════════════════════════════════\n');

    // Data Freshness
    const lastUpdate = new Date(data.marketData[0].date);
    const daysSinceUpdate = Math.floor((new Date() - lastUpdate) / (1000 * 60 * 60 * 24));
    
    console.log('Data Freshness:');
    console.log('───────────────────────────────────────');
    console.log(`Latest Data: ${lastUpdate.toISOString().split('T')[0]}`);
    console.log(`Days Since Update: ${daysSinceUpdate}`);
    console.log(`Status: ${daysSinceUpdate === 0 ? '🟢 Live' : daysSinceUpdate <= 1 ? '🟡 Recent' : '🔴 Stale'}\n`);

    // Market Data
    const latestPrice = data.marketData[0].close;
    const previousPrice = data.marketData[1].close;
    const dailyChange = ((latestPrice - previousPrice) / previousPrice * 100).toFixed(2);
    
    console.log('Market Data:');
    console.log('───────────────────────────────────────');
    console.log(`Symbol: ${data.symbol}`);
    console.log(`Price: $${latestPrice.toFixed(2)}`);
    console.log(`Daily Change: ${dailyChange}%\n`);

    // Technical Indicators
    const tech = data.analysis.technical;
    
    console.log('Technical Indicators:');
    console.log('───────────────────────────────────────');
    console.log(`RSI (14): ${tech.rsi.toFixed(2)}`);
    console.log(`Trend: ${tech.rsi > 70 ? '🔴 Overbought' : 
                        tech.rsi < 30 ? '🟢 Oversold' : 
                        '⚪ Neutral'}\n`);

    // Bollinger Bands
    console.log('Bollinger Bands:');
    console.log('───────────────────────────────────────');
    console.log(`Upper: $${tech.bollingerBands.upper.toFixed(2)}`);
    console.log(`Middle: $${tech.bollingerBands.middle.toFixed(2)}`);
    console.log(`Lower: $${tech.bollingerBands.lower.toFixed(2)}`);
    const bandWidth = ((tech.bollingerBands.upper - tech.bollingerBands.lower) / 
                      tech.bollingerBands.middle * 100).toFixed(2);
    console.log(`Band Width: ${bandWidth}%`);

    console.log(`Volatility: ${tech.bollingerBands.volatility.state}`);
    console.log(`Current: ${tech.bollingerBands.volatility.current.toFixed(2)}%`);
    console.log(`Average: ${tech.bollingerBands.volatility.average.toFixed(2)}%`);
    console.log(`Range: ${tech.bollingerBands.volatility.min.toFixed(2)}% - ${tech.bollingerBands.volatility.max.toFixed(2)}%`);

    console.log(`Squeeze:`);
    console.log(`Status: ${tech.bollingerBands.squeeze.active ? '🔴 Active' : '🟢 Inactive'}`);
    console.log(`Intensity: ${tech.bollingerBands.squeeze.intensity}`);
    console.log(`Bandwidth %: ${tech.bollingerBands.squeeze.bandwidthPercentile.toFixed(2)}%`);

    // MACD Analysis
    console.log('MACD Analysis:');
    console.log('───────────────────────────────────────');
    console.log(`Trend: ${tech.macd.trend}`);
    console.log(`Histogram: ${tech.macd.histogram.toFixed(2)}\n`);

    // Moving Averages
    console.log('Moving Averages:');
    console.log('───────────────────────────────────────');
    console.log(`EMA (20): $${tech.movingAverages.ema20.toFixed(2)}`);
    console.log(`SMA (50): $${tech.movingAverages.sma50.toFixed(2)}`);
    console.log(`SMA (200): $${tech.movingAverages.sma200.toFixed(2)}`);

    console.log(`Price Position: ${tech.movingAverages.pricePosition.status}`);
    console.log(`Overall Trend: ${tech.movingAverages.trend}`);

    if (tech.movingAverages.crosses.hasRecentCross) {
        console.log(`Recent Crosses:`);
        console.log(`${tech.movingAverages.crosses.ema20_sma50.bullish ? '• Bullish EMA20/SMA50 Cross\n' : ''}${tech.movingAverages.crosses.ema20_sma50.bearish ? '• Bearish EMA20/SMA50 Cross\n' : ''}${tech.movingAverages.crosses.ema20_sma200.bullish ? '• Bullish EMA20/SMA200 Cross\n' : ''}${tech.movingAverages.crosses.ema20_sma200.bearish ? '• Bearish EMA20/SMA200 Cross\n' : ''}${tech.movingAverages.crosses.sma50_sma200.bullish ? '• Bullish SMA50/SMA200 Cross\n' : ''}${tech.movingAverages.crosses.sma50_sma200.bearish ? '• Bearish SMA50/SMA200 Cross\n' : ''}`);
    }

    // Volume Analysis
    console.log('Volume Analysis:');
    console.log('───────────────────────────────────────');
    console.log(`Current Volume: ${data.marketData[0].volume.toLocaleString()}`);
    console.log(`10-Day Average: ${tech.volume.averages.tenDay.toLocaleString()}`);
    console.log(`20-Day Average: ${tech.volume.averages.twentyDay.toLocaleString()}`);
    console.log(`\nRelative Volume:`);
    console.log(`vs 10-Day: ${tech.volume.ratios.tenDay.toFixed(2)}%`);
    console.log(`vs 20-Day: ${tech.volume.ratios.twentyDay.toFixed(2)}%`);
    console.log(`\nOn-Balance Volume (OBV):`);
    console.log(`Trend: ${tech.volume.obv.trend}`);
    console.log(`Momentum: ${tech.volume.obv.momentum.toFixed(2)}%`);
    console.log(`\nVolume Signals:`);
    console.log(`Trend: ${tech.volume.trend}`);
    console.log(`Intensity: ${tech.volume.signals.intensity}`);
    console.log(`Accumulation: ${tech.volume.signals.accumulation ? '✓' : '✗'}`);
    console.log(`Distribution: ${tech.volume.signals.distribution ? '✓' : '✗'}\n`);

    // Breakout Analysis
    console.log('Breakout Analysis:');
    console.log('───────────────────────────────────────');
    console.log(`Direction: ${tech.breakout.direction} ${tech.breakout.direction === 'LONG' ? '📈' : '📉'}`);
    console.log(`Probability: ${tech.breakout.probability}% ${
        tech.breakout.probability >= 80 ? '🟢' :
        tech.breakout.probability >= 60 ? '🟡' : '🔴'
    }`);
    console.log(`Timeframe: ${tech.breakout.timeframe} 📅\n`);

    // AI Analysis
    console.log('AI Analysis:');
    console.log('───────────────────────────────────────');
    if (data.signals) {
        console.log(`Primary Signal: ${data.signals.primary} ${
            data.signals.primary === 'BULLISH' ? '🟢' :
            data.signals.primary === 'BEARISH' ? '🔴' : '⚪'
        }`);
        console.log(`Confidence: ${data.signals.confidence}%\n`);

        // Secondary Signals
        if (data.signals.secondary && data.signals.secondary.length > 0) {
            console.log('Key Factors:');
            data.signals.secondary.forEach(signal => console.log(`- ${signal}`));
            console.log();
        }
    }

    // Detailed AI Analysis
    if (data.analysis.summary) {
        console.log('Detailed Analysis:');
        console.log('───────────────────────────────────────');
        console.log(data.analysis.summary);
        console.log();
    }

    // Breakout Context
    if (data.analysis.breakoutContext) {
        console.log('Breakout Context:');
        console.log('───────────────────────────────────────');
        console.log(`Direction: ${data.analysis.breakoutContext.direction}`);
        console.log(`Strength: ${data.analysis.breakoutContext.strength}`);
        console.log(`Support: $${data.analysis.breakoutContext.support.toFixed(2)}`);
        console.log(`Resistance: $${data.analysis.breakoutContext.resistance.toFixed(2)}\n`);
    }
}

// Execute the analysis
testConsolidatedAnalysis().catch(console.error);

// Add AI debugging
console.log('\nVerifying OpenAI API key...');
console.log('Key exists:', !!process.env.OPENAI_API_KEY);
console.log('Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 3));
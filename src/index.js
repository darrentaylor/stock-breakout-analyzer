import dotenv from 'dotenv';
import { MarketDataAPI } from './services/MarketDataAPI.js';
import { TechnicalAnalysis } from './utils/TechnicalAnalysis.js';
import { OpenAIAnalyzer } from './services/OpenAIAnalyzer.js';

dotenv.config();

async function testConsolidatedAnalysis() {
    console.log('\n═══════════════════════════════════════════');
    console.log('       CONSOLIDATED ANALYSIS TEST           ');
    console.log('═══════════════════════════════════════════\n');

    try {
        // Initialize with environment variables
        const marketDataAPI = new MarketDataAPI(process.env.ALPHA_VANTAGE_KEY);
        const technicalAnalysis = new TechnicalAnalysis();
        const aiAnalyzer = new OpenAIAnalyzer(process.env.OPENAI_API_KEY);

        const symbol = 'AAPL';
        console.log(`\nAnalyzing ${symbol}:`);
        console.log('═══════════════════════════════════════════');

        // Get fresh market data
        console.log('Fetching latest market data...');
        const marketData = await marketDataAPI.getMarketData(symbol, true);
        
        // Run technical analysis
        console.log('\nRunning technical analysis...');
        const technicalData = technicalAnalysis.analyze(marketData);
        
        // Get AI insights
        console.log('\nGetting AI insights...');
        const aiAnalysis = await aiAnalyzer.analyzeStock(symbol, marketData, technicalData);

        // Display results
        displayConsolidatedAnalysis({
            symbol,
            marketData,
            analysis: {
                technical: technicalData,
                ai: aiAnalysis
            }
        });

    } catch (error) {
        console.error('Test failed:', error);
    }
}

function displayConsolidatedAnalysis(data) {
    console.log('\n═══════════════════════════════════════════');
    console.log('       CONSOLIDATED MARKET ANALYSIS         ');
    console.log('═══════════════════════════════════════════');

    // Data Freshness (from test-consolidated-analysis.js)
    const now = new Date();
    const dataDate = new Date(data.marketData[0].date);
    const daysSinceUpdate = Math.floor((now - dataDate) / (1000 * 60 * 60 * 24));
    
    console.log('\nData Freshness:');
    console.log('───────────────────────────────────────');
    console.log(`Latest Data: ${data.marketData[0].date}`);
    console.log(`Days Since Update: ${daysSinceUpdate}`);
    
    const status = daysSinceUpdate === 0 ? ['✅', 'Current'] :
                  daysSinceUpdate === 1 ? ['🟡', 'Recent'] :
                  daysSinceUpdate <= 3 ? ['⚠️', 'Stale'] : ['🔴', 'Outdated'];
    console.log(`Status: ${status[0]} ${status[1]}`);

    // Market Data
    console.log('\nMarket Data:');
    console.log('───────────────────────────────────────');
    console.log(`Symbol: ${data.symbol}`);
    console.log(`Price: $${data.marketData[0].close.toFixed(2)}`);
    console.log(`Daily Change: ${((data.marketData[0].close - data.marketData[0].open) / data.marketData[0].open * 100).toFixed(2)}%`);

    // Technical Analysis
    if (data.analysis.technical) {
        const tech = data.analysis.technical;
        
        // Bollinger Bands
        if (tech.bollingerBands) {
            console.log('\nBollinger Bands:');
            console.log('───────────────────────────────────────');
            const bb = tech.bollingerBands;
            console.log(`Upper: $${bb.upper.toFixed(2)}`);
            console.log(`Middle: $${bb.middle.toFixed(2)}`);
            console.log(`Lower: $${bb.lower.toFixed(2)}`);
            const width = ((bb.upper - bb.lower) / bb.middle * 100).toFixed(2);
            console.log(`Band Width: ${width}%`);
        }

        // MACD
        if (tech.macd) {
            console.log('\nMACD Analysis:');
            console.log('───────────────────────────────────────');
            console.log(`Trend: ${tech.macd.trend}`);
            console.log(`Histogram: ${tech.macd.histogram.toFixed(2)}`);
        }

        // Volume Analysis
        if (tech.volume) {
            console.log('\nVolume Analysis:');
            console.log('───────────────────────────────────────');
            console.log(`vs Average: ${tech.volume.current_vs_average.toFixed(2)}%`);
            console.log(`Trend: ${tech.volume.trend}`);
        }

        // Breakout Analysis
        if (tech.breakout) {
            console.log('\nBreakout Analysis:');
            console.log('───────────────────────────────────────');
            const breakout = tech.breakout;
            
            const directionEmoji = {
                'LONG': '🚀',
                'SHORT': '📉',
                'NEUTRAL': '️'
            }[breakout.direction] || '➡️';
            
            console.log(`Direction: ${breakout.direction} ${directionEmoji}`);
            console.log(`Probability: ${breakout.probability}% ${
                breakout.probability >= 70 ? '🟢' :
                breakout.probability >= 40 ? '🟡' : '🔴'
            }`);
            console.log(`Timeframe: ${breakout.timeframe} ${
                breakout.timeframe === 'SHORT' ? '⚡' :
                breakout.timeframe === 'MEDIUM' ? '📅' : '📈'
            }`);
        }
    }

    // AI Analysis
    if (data.analysis.ai) {
        console.log('\nAI Analysis:');
        console.log('───────────────────────────────────────');
        console.log(`Primary Signal: ${data.analysis.ai.signals.primary} ${
            data.analysis.ai.signals.primary === 'BULLISH' ? '🟢' :
            data.analysis.ai.signals.primary === 'BEARISH' ? '🔴' : '🟡'
        }`);
        console.log(`Confidence: ${data.analysis.ai.signals.confidence}%`);
        if (data.analysis.ai.analysis?.breakoutContext) {
            console.log('\nContext:', data.analysis.ai.analysis.breakoutContext);
        }
    }
}

// Execute the analysis
testConsolidatedAnalysis().catch(console.error);

// Add AI debugging
console.log('\nVerifying OpenAI API key...');
console.log('Key exists:', !!process.env.OPENAI_API_KEY);
console.log('Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 3));
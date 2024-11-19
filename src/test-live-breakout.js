import { MarketDataAPI } from './services/MarketDataAPI.js';
import { TechnicalAnalysis } from './utils/TechnicalAnalysis.js';
import dotenv from 'dotenv';

dotenv.config();

async function testLiveBreakout() {
    console.log('\n═══════════════════════════════════════════');
    console.log('          LIVE BREAKOUT ANALYSIS TEST       ');
    console.log('═══════════════════════════════════════════\n');

    try {
        const marketDataAPI = new MarketDataAPI(process.env.ALPHA_VANTAGE_KEY);
        const analysis = new TechnicalAnalysis();
        
        // Test with AAPL
        const symbol = 'AAPL';
        console.log(`Analyzing ${symbol}...`);
        
        const marketData = await marketDataAPI.getMarketData(symbol);
        console.log(`Retrieved ${marketData.length} days of market data`);
        
        const technicalData = analysis.analyze(marketData);
        
        // Display breakout analysis results
        console.log('\nBreakout Analysis:');
        console.log('───────────────────────────────────────');
        const breakout = technicalData.breakout;
        
        const directionEmoji = {
            'LONG': '🚀',
            'SHORT': '📉',
            'NEUTRAL': '➡️'
        }[breakout.direction] || '➡️';
        
        console.log(`Direction: ${breakout.direction} ${directionEmoji}`);
        
        const probColor = breakout.probability >= 70 ? '🟢' :
                         breakout.probability >= 40 ? '🟡' : '🔴';
        console.log(`Probability: ${breakout.probability}% ${probColor}`);
        
        const confColor = breakout.confidence >= 70 ? '🟢' :
                         breakout.confidence >= 40 ? '🟡' : '🔴';
        console.log(`Confidence: ${breakout.confidence}% ${confColor}`);
        
        const timeSymbol = {
            'SHORT': '⚡',
            'MEDIUM': '📅',
            'LONG': '📈'
        }[breakout.timeframe] || '📅';
        console.log(`Timeframe: ${breakout.timeframe} ${timeSymbol}`);

    } catch (error) {
        console.error('Test failed:', error);
        throw error;
    }
}

testLiveBreakout().catch(console.error);
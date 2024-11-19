import dotenv from 'dotenv';
import { OpenAIAnalyzer } from './services/OpenAIAnalyzer.js';
import { MarketDataAPI } from './services/MarketDataAPI.js';
import { TechnicalAnalysis } from './utils/TechnicalAnalysis.js';

dotenv.config();

async function testAIBreakoutAnalysis() {
    console.log('\n═══════════════════════════════════════════');
    console.log('          AI BREAKOUT ANALYSIS TEST         ');
    console.log('═══════════════════════════════════════════\n');

    try {
        const marketDataAPI = new MarketDataAPI(process.env.ALPHA_VANTAGE_KEY);
        const technicalAnalysis = new TechnicalAnalysis();
        const aiAnalyzer = new OpenAIAnalyzer(process.env.OPENAI_API_KEY);

        const symbol = 'AAPL';
        console.log(`Analyzing ${symbol}...`);

        const marketData = await marketDataAPI.getMarketData(symbol);
        console.log(`Retrieved ${marketData.length} days of market data`);

        const technicalData = technicalAnalysis.analyze(marketData);
        const aiAnalysis = await aiAnalyzer.analyzeStock(symbol, marketData, technicalData);

        // Display results
        console.log('\nAI Analysis Results:');
        console.log('───────────────────────────────────────');
        console.log('Score:', aiAnalysis.score);
        console.log('\nSignals:', aiAnalysis.signals);
        console.log('\nBreakout Context:', aiAnalysis.analysis.breakoutContext);

    } catch (error) {
        console.error('Test failed:', error);
        throw error;
    }
}

testAIBreakoutAnalysis().catch(console.error);
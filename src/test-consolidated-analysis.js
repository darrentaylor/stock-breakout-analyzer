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
        // Initialize services with our premium API key
        const marketDataAPI = new MarketDataAPI('C06SI2KXJN2N95Y9');
        const technicalAnalysis = new TechnicalAnalysis();
        const aiAnalyzer = new OpenAIAnalyzer(process.env.OPENAI_API_KEY);

        // Test with popular symbols
        const symbols = ['AAPL', 'MSFT', 'GOOGL'];

        for (const symbol of symbols) {
            console.log(`\nAnalyzing ${symbol}:`);
            console.log('═══════════════════════════════════════════');

            // Fetch latest market data
            const marketData = await marketDataAPI.getMarketData(symbol, true);
            
            // Run technical analysis
            const technicalData = technicalAnalysis.analyze(marketData);
            
            // Get AI insights
            const aiAnalysis = await aiAnalyzer.analyzeStock(symbol, marketData, technicalData);

            // Display consolidated results using the format from index.js
            displayConsolidatedAnalysis({
                symbol,
                marketData,
                analysis: {
                    technical: technicalData,
                    ai: aiAnalysis
                }
            });

            // Add delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Using the displayConsolidatedAnalysis function from index.js
// Reference: src/index.js lines 417-480
function displayConsolidatedAnalysis(result) {
    // Implementation referenced from index.js
    console.log('\n═══════════════════════════════════════════');
    console.log('       CONSOLIDATED TECHNICAL ANALYSIS      ');
    console.log('═══════════════════════════════════════════\n');

    const latestData = result.marketData[result.marketData.length - 1];
    const dataDate = new Date(latestData.date);
    const now = new Date();
    const daysSinceUpdate = Math.floor((now - dataDate) / (1000 * 60 * 60 * 24));
    
    // Data Freshness Section
    console.log('Data Freshness:');
    console.log('───────────────────────────────────────');
    console.log(`Current Date: ${now.toISOString().split('T')[0]}`);
    console.log(`Latest Data: ${latestData.date}`);
    console.log(`Days Since Update: ${daysSinceUpdate}`);
    
    // Status Check
    const status = daysSinceUpdate === 0 ? ['✅', 'Current'] :
                  daysSinceUpdate === 1 ? ['🟡', 'Recent (1 day old)'] :
                  daysSinceUpdate <= 3 ? ['⚠️', 'Stale (needs update)'] :
                  ['🔴', 'Outdated (requires immediate update)'];
                  
    console.log(`Status: ${status[0]} ${status[1]}`);

    // Technical Analysis Section
    const technical = result.analysis.technical;
    console.log('\nTechnical Analysis:');
    console.log('───────────────────────────────────────');
    console.log(`Price: $${latestData.close.toFixed(2)}`);
    console.log(`Daily Change: ${((latestData.close - latestData.open) / latestData.open * 100).toFixed(2)}%`);
    
    // AI Analysis Section
    const ai = result.analysis.ai;
    if (ai) {
        console.log('\nAI Analysis:');
        console.log('───────────────────────────────────────');
        console.log(`Score: ${ai.score.total}%`);
        console.log(`Primary Signal: ${ai.signals.primary}`);
        console.log(`Confidence: ${ai.signals.confidence}%`);
        
        if (ai.analysis?.breakoutContext) {
            console.log('\nBreakout Context:');
            console.log(ai.analysis.breakoutContext);
        }
    }
}

// Run the test
testConsolidatedAnalysis().catch(console.error);
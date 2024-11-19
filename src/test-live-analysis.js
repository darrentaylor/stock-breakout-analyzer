import { AlphaVantageService } from './services/AlphaVantageService.js';
import { TechnicalAnalysis } from './utils/TechnicalAnalysis.js';
import { config } from './config/env.js';

async function testLiveAnalysis() {
    console.log('\n═══════════════════════════════════════════');
    console.log('          LIVE MARKET ANALYSIS TEST         ');
    console.log('═══════════════════════════════════════════\n');

    try {
        const alphaVantage = new AlphaVantageService(config.alphaVantage.apiKey);
        const analysis = new TechnicalAnalysis(alphaVantage);
        
        // Test with a few popular symbols
        const symbols = ['AAPL', 'MSFT', 'GOOGL'];
        
        for (const symbol of symbols) {
            console.log(`\nAnalyzing ${symbol}:`);
            console.log('───────────────────────────────────────');
            
            const result = await analysis.analyzeWithLiveData(symbol);
            
            // Display results using our existing format
            const directionEmoji = {
                'LONG': '🚀',
                'SHORT': '📉',
                'NEUTRAL': '➡️'
            }[result.direction] || '➡️';
            
            console.log(`Direction: ${result.direction} ${directionEmoji}`);
            
            const probColor = result.probability >= 70 ? '🟢' :
                            result.probability >= 40 ? '🟡' : '🔴';
            console.log(`Probability: ${result.probability}% ${probColor}`);
            
            const confColor = result.confidence >= 70 ? '🟢' :
                            result.confidence >= 40 ? '🟡' : '🔴';
            console.log(`Confidence: ${result.confidence}% ${confColor}`);
            
            const timeSymbol = {
                'SHORT': '⚡',
                'MEDIUM': '📅',
                'LONG': '📈'
            }[result.timeframe] || '📅';
            console.log(`Timeframe: ${result.timeframe} ${timeSymbol}`);
            
            // Add a delay to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 15000));
        }

    } catch (error) {
        console.error('Live analysis test failed:', error);
        throw error;
    }
}

testLiveAnalysis().catch(console.error);
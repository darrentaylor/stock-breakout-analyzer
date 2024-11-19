import { MarketDataAPI } from '../src/services/MarketDataAPI.js';
import { TechnicalAnalysis } from '../src/utils/TechnicalAnalysis.js';
import { PatternRecognitionService } from '../src/services/PatternRecognitionService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testPatternRecognition() {
    try {
        // Initialize services
        const marketDataAPI = new MarketDataAPI(process.env.ALPHA_VANTAGE_KEY);
        const technicalAnalysis = new TechnicalAnalysis();

        // Test symbols with known patterns
        const symbols = ['AAPL', 'MSFT', 'GOOGL'];
        
        console.log('\n=== Pattern Recognition Test ===\n');

        for (const symbol of symbols) {
            console.log(`\nAnalyzing ${symbol}...`);
            
            // Fetch market data
            const marketData = await marketDataAPI.getMarketData(symbol);
            console.log(`Retrieved ${marketData.length} days of data`);

            // Perform technical analysis with pattern recognition
            const analysis = technicalAnalysis.analyze(marketData);

            // Display pattern analysis results
            console.log('\nPattern Analysis Results:');
            console.log('------------------------');
            
            if (analysis.patterns.summary.patternsFound) {
                console.log('Patterns Detected:');
                analysis.patterns.summary.allPatterns.forEach(pattern => {
                    console.log(`- ${pattern.type} (Confidence: ${pattern.confidence.toFixed(2)}%)`);
                });

                console.log('\nDominant Pattern:');
                const dominant = analysis.patterns.summary.dominantPattern;
                console.log(`Type: ${dominant.type}`);
                console.log(`Confidence: ${dominant.confidence.toFixed(2)}%`);
            } else {
                console.log('No significant patterns detected');
            }

            // Display breakout analysis
            console.log('\nBreakout Analysis:');
            console.log('------------------');
            console.log(`Direction: ${analysis.breakout.direction}`);
            console.log(`Probability: ${analysis.breakout.probability.toFixed(2)}%`);
            console.log(`Confidence: ${analysis.breakout.confidence}%`);

            console.log('\nSignal Analysis:');
            console.log('---------------');
            Object.entries(analysis.breakout.signals).forEach(([signal, value]) => {
                console.log(`${signal}: ${value}`);
            });

            // Display supporting technical indicators
            console.log('\nSupporting Indicators:');
            console.log('---------------------');
            console.log(`RSI: ${analysis.rsi.toFixed(2)}`);
            console.log(`MACD Histogram: ${analysis.macd.histogram.toFixed(4)}`);
            console.log(`Volume vs Average: ${analysis.volume.current_vs_average}%`);
            console.log(`MFI: ${analysis.mfi.value.toFixed(2)} (${analysis.mfi.signal})`);
        }

    } catch (error) {
        console.error('Error during pattern recognition test:', error);
    }
}

// Run the test
console.log('Starting pattern recognition test...');
testPatternRecognition().then(() => {
    console.log('\nPattern recognition test completed.');
}).catch(error => {
    console.error('Test failed:', error);
});

import { TechnicalAnalysis } from './utils/TechnicalAnalysis.js';
import { createMockMarketData, createMockTechnicalData } from './utils/mockData.js';

async function testBreakoutAnalysis() {
    console.log('\n═══════════════════════════════════════════');
    console.log('          BREAKOUT ANALYSIS TEST            ');
    console.log('═══════════════════════════════════════════\n');

    const analysis = new TechnicalAnalysis();
    const mockMarketData = createMockMarketData();
    const mockTechnicalData = createMockTechnicalData();

    // Debug logs
    console.log('Debug Information:');
    console.log('─────────────────');
    console.log('Market Data (latest):', mockMarketData[0]);
    console.log('Technical Data:', {
        bbWidth: ((mockTechnicalData.bollingerBands.upper - mockTechnicalData.bollingerBands.lower) / 
                   mockTechnicalData.bollingerBands.middle) * 100,
        volume: mockTechnicalData.volume.current_vs_average,
        macd: mockTechnicalData.macd.trend,
        ma: mockTechnicalData.movingAverages.trend
    });
    console.log('─────────────────\n');

    const breakout = analysis.analyzeBreakout(mockMarketData, mockTechnicalData);

    // Display results
    console.log('Breakout Analysis:');
    console.log('───────────────────────────────────────');
    
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

    // Test invalid data handling
    console.log('\nTesting Invalid Data Handling:');
    console.log('───────────────────────────────────────');
    const invalidResult = analysis.analyzeBreakout([{}], {
        bollingerBands: {},
        volume: {},
        macd: {},
        movingAverages: {}
    });
    console.log('Invalid Data Result:', invalidResult);
}

testBreakoutAnalysis().catch(console.error);
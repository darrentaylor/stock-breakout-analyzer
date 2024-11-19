import { TechnicalAnalysis } from './utils/TechnicalAnalysis.js';

async function testTechnicalAnalysis() {
    console.log('\n═══════════════════════════════════════');
    console.log('    TECHNICAL ANALYSIS TEST             ');
    console.log('═══════════════════════════════════════\n');

    const analysis = new TechnicalAnalysis();
    
    // Create mock data
    const mockData = Array(50).fill().map((_, i) => ({
        date: new Date(2024, 0, i + 1).toISOString(),
        close: 100 + Math.sin(i / 5) * 10,
        high: 105 + Math.sin(i / 5) * 10,
        low: 95 + Math.sin(i / 5) * 10,
        volume: 1000000 + (i * 10000)
    }));

    try {
        console.log('Testing with mock market data...');
        const result = analysis.analyze(mockData);

        console.log('\nTechnical Analysis Results:');
        console.log('───────────────────────────────────────');
        console.log('Bollinger Bands:', {
            trend: result.bollingerBands.trend,
            width: result.bollingerBands.upper - result.bollingerBands.lower
        });
        console.log('Volume:', {
            vsAverage: result.volume.current_vs_average + '%',
            trend: result.volume.trend
        });
        console.log('MACD:', {
            trend: result.macd.trend,
            histogram: result.macd.histogram.toFixed(2)
        });
        console.log('Moving Averages:', {
            trend: result.movingAverages.trend,
            location: result.movingAverages.priceLocation
        });

        // Add Breakout Analysis Display
        console.log('\nBreakout Analysis:');
        console.log('───────────────────────────────────────');
        const breakout = result.breakout;
        
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

testTechnicalAnalysis().catch(console.error);
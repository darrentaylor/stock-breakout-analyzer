export const createMockMarketData = (days = 50) => {
    return Array(days).fill().map((_, i) => ({
        date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
        close: 110,
        high: 112,
        low: 108,
        volume: 2000000
    }));
};

export const createMockTechnicalData = () => ({
    bollingerBands: {
        upper: 105,
        middle: 100,
        lower: 95
    },
    volume: {
        current_vs_average: 180,
        trend: 'RISING',
        accumulation: true
    },
    macd: {
        trend: 'BULLISH',
        value: 0.5,
        signal: 0.3,
        histogram: 0.2
    },
    movingAverages: {
        trend: 'BULLISH',
        values: {
            ema20: 101,
            ema50: 99,
            ema200: 98
        }
    }
});
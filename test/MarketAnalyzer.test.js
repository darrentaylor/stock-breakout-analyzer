import { expect, test, describe } from 'vitest';
import { MarketAnalyzer } from '../src/services/MarketAnalyzer.js';

describe('MarketAnalyzer', () => {
  test('should calculate correct score for consolidating stock', async () => {
    const mockData = {
      prices: Array(20).fill().map((_, i) => ({
        high: 100 + (i * 0.1),
        low: 99 + (i * 0.1),
        close: 99.5 + (i * 0.1),
        volume: 1000000
      }))
    };

    const analyzer = new MarketAnalyzer({
      getMarketData: async () => mockData
    });

    const score = analyzer.calculateScore(mockData);
    expect(score).toBeGreaterThan(0);
  });

  // Add more tests...
});
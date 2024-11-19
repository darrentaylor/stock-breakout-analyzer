import { BollingerBands } from '../../indicators/BollingerBands.js';

describe('BollingerBands', () => {
  test('should calculate Bollinger Bands correctly', () => {
    const testData = [
      { date: new Date('2024-01-01'), close: 100 },
      { date: new Date('2024-01-02'), close: 105 },
      { date: new Date('2024-01-03'), close: 95 },
      // Add more test data...
    ];

    const bb = new BollingerBands(testData, 3); // Smaller period for testing
    const results = bb.calculate();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('middle');
    expect(results[0]).toHaveProperty('upper');
    expect(results[0]).toHaveProperty('lower');
  });

  test('should calculate squeeze metrics correctly', () => {
    const testData = Array(50).fill().map((_, i) => ({
      date: new Date(`2024-01-${i + 1}`),
      close: 100 + Math.sin(i / 5) * (i < 25 ? 10 : 2) // Create artificial squeeze
    }));

    const bb = new BollingerBands(testData);
    const results = bb.calculate();
    const lastResult = results[results.length - 1];

    expect(lastResult.squeeze).toBeDefined();
    expect(lastResult.squeeze).toHaveProperty('isSqueezing');
    expect(lastResult.squeeze).toHaveProperty('bandwidthPercentile');
    expect(lastResult.squeeze).toHaveProperty('averageBandwidth');
    expect(lastResult.squeeze).toHaveProperty('currentBandwidth');
  });
});
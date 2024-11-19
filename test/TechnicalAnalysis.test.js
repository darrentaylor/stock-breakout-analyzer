import { expect, test, describe } from 'vitest';
import { TechnicalAnalysis } from '../src/utils/TechnicalAnalysis.js';
import { createMockMarketData, createMockTechnicalData } from '../src/utils/mockData.js';

describe('TechnicalAnalysis', () => {
  test('MACD calculation returns expected format', () => {
    const analysis = new TechnicalAnalysis();
    
    const mockData = Array(50).fill().map((_, i) => ({
      close: 100 + Math.sin(i / 5) * 10,
      high: 105 + Math.sin(i / 5) * 10,
      low: 95 + Math.sin(i / 5) * 10,
      volume: 1000000
    }));
    
    const macd = analysis.calculateMACD(mockData);
    
    expect(macd).toBeDefined();
    expect(typeof macd.value).toBe('number');
    expect(typeof macd.signal).toBe('number');
    expect(typeof macd.histogram).toBe('number');
    expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(macd.trend);
  });

  test('Moving Averages calculation returns expected format', () => {
    const analysis = new TechnicalAnalysis();
    
    const mockData = Array(250).fill().map((_, i) => ({
      close: 100 + Math.sin(i / 20) * 10,
      high: 105 + Math.sin(i / 20) * 10,
      low: 95 + Math.sin(i / 20) * 10,
      volume: 1000000
    }));
    
    const ma = analysis.calculateMovingAverages(mockData);
    
    expect(ma).toBeDefined();
    expect(ma.values).toHaveProperty('ema20');
    expect(ma.values).toHaveProperty('ema50');
    expect(ma.values).toHaveProperty('ema200');
    expect(ma).toHaveProperty('priceLocation');
    expect(ma).toHaveProperty('crosses');
    expect(ma).toHaveProperty('trend');
  });

  test('OBV calculation returns expected format', () => {
    const analysis = new TechnicalAnalysis();
    
    const mockData = Array(50).fill().map((_, i) => ({
      close: 100 + Math.sin(i / 5) * 10,
      high: 105 + Math.sin(i / 5) * 10,
      low: 95 + Math.sin(i / 5) * 10,
      volume: 1000000 + (i * 10000)
    }));
    
    const obv = analysis.calculateOBV(mockData);
    
    expect(obv).toBeDefined();
    expect(typeof obv.value).toBe('number');
    expect(['RISING', 'FALLING', 'NEUTRAL', 'VOLATILE']).toContain(obv.trend);
    expect(['BULLISH', 'BEARISH', 'DIVERGENCE_BULLISH', 'DIVERGENCE_BEARISH', 'NEUTRAL']).toContain(obv.signal);
  });

  test('Volume MA calculation returns expected format with enhanced metrics', () => {
    const analysis = new TechnicalAnalysis();
    
    const mockData = Array(50).fill().map((_, i) => ({
      close: 100 + Math.sin(i / 5) * 10,
      high: 105 + Math.sin(i / 5) * 10,
      low: 95 + Math.sin(i / 5) * 10,
      volume: 1000000 + (i * 10000)
    }));
    
    const volumeMA = analysis.calculateVolumeMA(mockData);
    
    expect(volumeMA).toBeDefined();
    expect(typeof volumeMA.current).toBe('number');
    expect(typeof volumeMA.ma10).toBe('number');
    expect(typeof volumeMA.ma20).toBe('number');
    expect(volumeMA.trend).toHaveProperty('direction');
    expect(['UP', 'DOWN', 'SIDEWAYS']).toContain(volumeMA.trend.direction);
    expect(volumeMA.obv).toBeDefined();
    expect(typeof volumeMA.signalStrength).toBe('number');
    expect(volumeMA.signalStrength).toBeGreaterThanOrEqual(0);
    expect(volumeMA.signalStrength).toBeLessThanOrEqual(100);
  });

  test('analyzeBreakout returns expected format', () => {
    const analysis = new TechnicalAnalysis();
    
    const mockMarketData = Array(50).fill().map((_, i) => ({
      close: 100 + Math.sin(i / 5) * 10,
      high: 105 + Math.sin(i / 5) * 10,
      low: 95 + Math.sin(i / 5) * 10,
      volume: 1000000 + (i * 10000)
    }));
    
    const mockTechnicalData = {
      bollingerBands: {
        upper: 110,
        middle: 100,
        lower: 90
      },
      volume: {
        current_vs_average: 160
      },
      macd: {
        trend: 'BULLISH'
      },
      movingAverages: {
        trend: 'BULLISH'
      }
    };
    
    const breakout = analysis.analyzeBreakout(mockMarketData, mockTechnicalData);
    
    expect(breakout).toHaveProperty('probability');
    expect(breakout).toHaveProperty('direction');
    expect(breakout).toHaveProperty('confidence');
    expect(breakout).toHaveProperty('timeframe');
    
    expect(breakout.probability).toBeGreaterThanOrEqual(0);
    expect(breakout.probability).toBeLessThanOrEqual(100);
    expect(['LONG', 'SHORT', 'NEUTRAL']).toContain(breakout.direction);
    expect(breakout.confidence).toBeGreaterThanOrEqual(0);
    expect(breakout.confidence).toBeLessThanOrEqual(100);
    expect(['SHORT', 'MEDIUM', 'LONG']).toContain(breakout.timeframe);
  });
});

describe('Breakout Analysis', () => {
    test('analyzeBreakout returns expected format', () => {
        const analysis = new TechnicalAnalysis();
        const mockData = createMockMarketData();
        const mockTechnical = createMockTechnicalData();
        
        const breakout = analysis.analyzeBreakout(mockData, mockTechnical);
        
        expect(breakout).toHaveProperty('probability');
        expect(breakout).toHaveProperty('direction');
        expect(breakout).toHaveProperty('confidence');
        expect(breakout).toHaveProperty('timeframe');
        
        expect(breakout.probability).toBeGreaterThanOrEqual(0);
        expect(breakout.probability).toBeLessThanOrEqual(100);
        expect(['LONG', 'SHORT', 'NEUTRAL']).toContain(breakout.direction);
        expect(breakout.confidence).toBeGreaterThanOrEqual(0);
        expect(breakout.confidence).toBeLessThanOrEqual(100);
        expect(['SHORT', 'MEDIUM', 'LONG']).toContain(breakout.timeframe);
    });

    test('analyzeBreakout handles invalid data gracefully', () => {
        const analysis = new TechnicalAnalysis();
        const invalidData = [{}];
        const invalidTechnical = {
            bollingerBands: {},
            volume: {},
            macd: {},
            movingAverages: {}
        };
        
        const breakout = analysis.analyzeBreakout(invalidData, invalidTechnical);
        
        expect(breakout.direction).toBe('NEUTRAL');
        expect(breakout.probability).toBe(0);
        expect(breakout.confidence).toBe(0);
        expect(breakout.timeframe).toBe('MEDIUM');
    });
});
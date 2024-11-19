import { z } from 'zod';
import { logger } from './logger.js';

const marketDataSchema = z.array(z.object({
  timestamp: z.string().datetime(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().int().positive(),
  interval: z.enum(['daily'])
})).min(1);

export function validateMarketData(data) {
  try {
    marketDataSchema.parse(data);
    
    // Additional validation rules
    const isValid = data.every(candle => (
      candle.high >= candle.low &&
      candle.high >= candle.open &&
      candle.high >= candle.close &&
      candle.low <= candle.open &&
      candle.low <= candle.close &&
      candle.volume > 0
    ));

    if (!isValid) {
      throw new Error('Invalid price relationships in market data');
    }

    // Validate sequential timestamps
    for (let i = 1; i < data.length; i++) {
      const curr = new Date(data[i].timestamp);
      const prev = new Date(data[i-1].timestamp);
      if (curr <= prev) {
        throw new Error('Timestamps are not in ascending order');
      }
    }

    return true;
  } catch (error) {
    logger.error('Market data validation failed:', error.message);
    return false;
  }
}
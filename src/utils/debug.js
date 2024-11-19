import { logger } from './logger.js';

export class DebugHelper {
  static logState(data, category) {
    logger.debug(`[${category}] State:`, {
      data: JSON.stringify(data, null, 2)
    });
  }

  static async validateMarketData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      logger.error('Invalid market data structure');
      return false;
    }

    const requiredFields = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
    const isValid = data.every(candle => 
      requiredFields.every(field => candle[field] !== undefined)
    );

    if (!isValid) {
      logger.error('Market data missing required fields');
      return false;
    }

    return true;
  }

  static validateAnalysis(analysis) {
    const requiredFields = ['score', 'signals', 'analysis'];
    const isValid = requiredFields.every(field => analysis[field] !== undefined);

    if (!isValid) {
      logger.error('Analysis missing required fields');
      return false;
    }

    return true;
  }
}
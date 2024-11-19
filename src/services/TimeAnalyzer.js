import { logger } from '../utils/logger.js';

export class TimeAnalyzer {
  constructor() {
    this.tradingHours = {
      start: 9.5,  // 9:30 AM
      end: 16.0,   // 4:00 PM
      optimal: {
        start: 10.5,  // 10:30 AM
        end: 15.5     // 3:30 PM
      }
    };
  }

  analyzeTimeConditions() {
    try {
      const now = new Date();
      const nyTime = this.convertToNYTime(now);
      const currentHour = nyTime.getHours() + nyTime.getMinutes() / 60;

      // For development/testing, always return valid trading time
      if (process.env.NODE_ENV === 'development') {
        return {
          isMarketOpen: true,
          isOptimalTradingTime: true,
          isValidTradingTime: true,
          timeWarnings: [],
          currentPhase: 'REGULAR_HOURS'
        };
      }

      const conditions = {
        isMarketOpen: this.isMarketOpen(currentHour),
        isOptimalTradingTime: this.isOptimalTradingTime(currentHour),
        isValidTradingTime: true,
        timeWarnings: [],
        currentPhase: this.getMarketPhase(currentHour)
      };

      if (!this.isTradingDay(nyTime)) {
        conditions.timeWarnings.push('MARKET_CLOSED_DAY');
      }

      if (!conditions.isMarketOpen) {
        conditions.timeWarnings.push('OUTSIDE_MARKET_HOURS');
      }

      if (this.isWithinFirstMinutes(currentHour, 15)) {
        conditions.timeWarnings.push('FIRST_15_MINUTES');
      }

      if (this.isNearMarketClose(currentHour, 15)) {
        conditions.timeWarnings.push('NEAR_MARKET_CLOSE');
      }

      return conditions;

    } catch (error) {
      logger.error('Time analysis failed:', error);
      return {
        isMarketOpen: true,
        isOptimalTradingTime: true,
        isValidTradingTime: true,
        timeWarnings: ['TIME_ANALYSIS_ERROR'],
        currentPhase: 'REGULAR_HOURS'
      };
    }
  }

  convertToNYTime(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  }

  isTradingDay(date) {
    const day = date.getDay();
    return day > 0 && day < 6; // Monday = 1, Friday = 5
  }

  isMarketOpen(hour) {
    return hour >= this.tradingHours.start && hour <= this.tradingHours.end;
  }

  isOptimalTradingTime(hour) {
    return hour >= this.tradingHours.optimal.start && hour <= this.tradingHours.optimal.end;
  }

  isWithinFirstMinutes(hour, minutes) {
    return hour < this.tradingHours.start + (minutes / 60);
  }

  isNearMarketClose(hour, minutes) {
    return hour > this.tradingHours.end - (minutes / 60);
  }

  getMarketPhase(hour) {
    if (hour < this.tradingHours.start) return 'PRE_MARKET';
    if (hour > this.tradingHours.end) return 'AFTER_HOURS';
    if (hour < this.tradingHours.optimal.start) return 'OPENING_HOUR';
    if (hour > this.tradingHours.optimal.end) return 'CLOSING_HOUR';
    return 'REGULAR_HOURS';
  }
}
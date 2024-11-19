import NodeCache from 'node-cache';
import { logger } from '../utils/logger.js';

export class DataManager {
    constructor() {
        // Short-term cache for intraday data (5 minutes)
        this.intradayCache = new NodeCache({ 
            stdTTL: 300,  // 5 minutes
            checkperiod: 60  // Check for expired keys every 60 seconds
        });

        // Medium-term cache for daily data (4 hours)
        this.dailyCache = new NodeCache({ 
            stdTTL: 14400,  // 4 hours
            checkperiod: 300  // Check every 5 minutes
        });

        // Long-term cache for historical data (24 hours)
        this.historicalCache = new NodeCache({ 
            stdTTL: 86400,  // 24 hours
            checkperiod: 3600  // Check every hour
        });
    }

    // Cache keys
    getIntradayKey(symbol) { return `intraday_${symbol}`; }
    getDailyKey(symbol) { return `daily_${symbol}`; }
    getHistoricalKey(symbol) { return `historical_${symbol}`; }

    // Data freshness check
    isDataFresh(data, maxAge) {
        if (!data || !data.timestamp) return false;
        
        const dataAge = Date.now() - new Date(data.timestamp).getTime();
        return dataAge <= maxAge;
    }

    // Market hours check
    isMarketOpen() {
        const now = new Date();
        const nyTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const hour = nyTime.getHours();
        const minute = nyTime.getMinutes();
        const day = nyTime.getDay();

        // Check if it's a weekday
        if (day === 0 || day === 6) return false;

        // Convert current time to minutes since midnight
        const currentMinutes = hour * 60 + minute;

        // Market hours: 9:30 AM to 4:00 PM
        const marketOpen = 9 * 60 + 30;  // 9:30 AM
        const marketClose = 16 * 60;     // 4:00 PM

        return currentMinutes >= marketOpen && currentMinutes < marketClose;
    }

    // Cache data with appropriate TTL based on market hours
    async cacheData(symbol, data, type = 'daily') {
        const timestamp = new Date().toISOString();
        const enrichedData = { ...data, timestamp };

        switch (type) {
            case 'intraday':
                // Shorter TTL during market hours
                const ttl = this.isMarketOpen() ? 300 : 3600;  // 5 min during market hours, 1 hour otherwise
                this.intradayCache.set(this.getIntradayKey(symbol), enrichedData, ttl);
                break;

            case 'daily':
                this.dailyCache.set(this.getDailyKey(symbol), enrichedData);
                break;

            case 'historical':
                this.historicalCache.set(this.getHistoricalKey(symbol), enrichedData);
                break;
        }

        logger.debug(`Cached ${type} data for ${symbol}`);
    }

    // Get cached data with freshness check
    async getCachedData(symbol, type = 'daily', maxAge = null) {
        const cacheKey = type === 'intraday' ? this.getIntradayKey(symbol) :
                        type === 'daily' ? this.getDailyKey(symbol) :
                        this.getHistoricalKey(symbol);

        const cache = type === 'intraday' ? this.intradayCache :
                     type === 'daily' ? this.dailyCache :
                     this.historicalCache;

        const data = cache.get(cacheKey);

        // If no maxAge specified, return cached data if it exists
        if (!maxAge) return data || null;

        // Check data freshness if maxAge is specified
        return this.isDataFresh(data, maxAge) ? data : null;
    }

    // Invalidate cache for a symbol
    invalidateCache(symbol, type = 'all') {
        if (type === 'all' || type === 'intraday') {
            this.intradayCache.del(this.getIntradayKey(symbol));
        }
        if (type === 'all' || type === 'daily') {
            this.dailyCache.del(this.getDailyKey(symbol));
        }
        if (type === 'all' || type === 'historical') {
            this.historicalCache.del(this.getHistoricalKey(symbol));
        }
        logger.debug(`Invalidated ${type} cache for ${symbol}`);
    }

    // Clear all caches
    clearAllCaches() {
        this.intradayCache.flushAll();
        this.dailyCache.flushAll();
        this.historicalCache.flushAll();
        logger.debug('All caches cleared');
    }

    // Validate data structure
    validateData(data) {
        if (!data || typeof data !== 'object') return false;

        const requiredFields = ['open', 'high', 'low', 'close', 'volume'];
        return requiredFields.every(field => {
            const value = data[field];
            return value !== undefined && 
                   value !== null && 
                   !isNaN(value) && 
                   value > 0;
        });
    }

    // Check for unrealistic price movements
    detectPriceAnomalies(data) {
        if (!Array.isArray(data) || data.length < 2) return false;

        const maxPriceChange = 0.2; // 20% max price change between periods
        for (let i = 1; i < data.length; i++) {
            const priceChange = Math.abs(data[i].close - data[i-1].close) / data[i-1].close;
            if (priceChange > maxPriceChange) {
                logger.warn(`Unusual price movement detected: ${priceChange * 100}% change`);
                return true;
            }
        }
        return false;
    }
}

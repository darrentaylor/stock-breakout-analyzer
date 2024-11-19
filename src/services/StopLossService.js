import { logger } from '../utils/logger.js';

export class StopLossService {
    constructor() {
        // ATR-based stop loss multipliers
        this.TIGHT_ATR_MULTIPLIER = 1.5;
        this.NORMAL_ATR_MULTIPLIER = 2.0;
        this.WIDE_ATR_MULTIPLIER = 3.0;

        // Time-based stop parameters (in days)
        this.SHORT_TERM_PERIOD = 5;
        this.MEDIUM_TERM_PERIOD = 10;
        this.LONG_TERM_PERIOD = 20;

        // Technical level buffer (percentage)
        this.SUPPORT_BUFFER = 0.005; // 0.5% below support
        this.RESISTANCE_BUFFER = 0.005; // 0.5% above resistance

        // Volatility thresholds
        this.HIGH_VOLATILITY_THRESHOLD = 0.03; // 3% ATR/Price ratio
        this.LOW_VOLATILITY_THRESHOLD = 0.01; // 1% ATR/Price ratio

        // Pattern-specific multipliers
        this.PATTERN_MULTIPLIERS = {
            HEAD_AND_SHOULDERS: { multiplier: 1.5, confidence_threshold: 0.7 },
            DOUBLE_BOTTOM: { multiplier: 2.0, confidence_threshold: 0.75 },
            DOUBLE_TOP: { multiplier: 2.0, confidence_threshold: 0.75 },
            TRIANGLE: { multiplier: 1.75, confidence_threshold: 0.65 },
            FLAG: { multiplier: 1.5, confidence_threshold: 0.6 },
            WEDGE: { multiplier: 1.75, confidence_threshold: 0.7 },
            CHANNEL: { multiplier: 1.5, confidence_threshold: 0.65 }
        };

        // Trailing stop parameters
        this.TRAILING_ACTIVATION_THRESHOLD = 0.02; // 2% profit
        this.TRAILING_STEP_SIZE = 0.005; // 0.5% step size
    }

    calculateLevels(data, technical) {
        try {
            const { current, historical } = data;
            
            if (!historical || historical.length < 20) {
                throw new Error('Insufficient historical data for stop loss calculation');
            }

            if (!current) {
                throw new Error('Current price is required for stop loss calculation');
            }

            // Calculate ATR-based stops
            const atrStops = this.calculateATRStops(current, technical.atr?.value || 0);

            // Calculate time-based stops
            const timeBasedStops = this.calculateTimeBasedStops(historical);

            // Calculate technical level stops
            const technicalStops = this.calculateTechnicalStops(current, technical);

            // Calculate volatility-based stops
            const volatilityStops = this.calculateVolatilityStops(current, historical);

            // Calculate pattern-based stops if patterns exist
            const patternStops = this.calculatePatternStops(current, technical.patterns || []);

            return {
                atr: atrStops,
                timeBased: timeBasedStops,
                technical: technicalStops,
                volatility: volatilityStops,
                pattern: patternStops,
                recommended: this.calculateRecommendedStop({
                    atrStops,
                    timeBasedStops,
                    technicalStops,
                    volatilityStops,
                    patternStops
                }, technical.trend)
            };

        } catch (error) {
            logger.error('Error calculating stop loss levels:', error);
            return {
                error: error.message,
                atr: null,
                timeBased: null,
                technical: null,
                volatility: null,
                pattern: null,
                recommended: null
            };
        }
    }

    calculateATRStops(currentPrice, atr) {
        if (!atr) {
            return {
                tight: null,
                normal: null,
                wide: null
            };
        }

        return {
            tight: {
                price: currentPrice - (atr * this.TIGHT_ATR_MULTIPLIER),
                distance: atr * this.TIGHT_ATR_MULTIPLIER,
                percentage: (atr * this.TIGHT_ATR_MULTIPLIER / currentPrice) * 100
            },
            normal: {
                price: currentPrice - (atr * this.NORMAL_ATR_MULTIPLIER),
                distance: atr * this.NORMAL_ATR_MULTIPLIER,
                percentage: (atr * this.NORMAL_ATR_MULTIPLIER / currentPrice) * 100
            },
            wide: {
                price: currentPrice - (atr * this.WIDE_ATR_MULTIPLIER),
                distance: atr * this.WIDE_ATR_MULTIPLIER,
                percentage: (atr * this.WIDE_ATR_MULTIPLIER / currentPrice) * 100
            }
        };
    }

    calculateTimeBasedStops(historicalData) {
        const periods = {
            short: this.SHORT_TERM_PERIOD,
            medium: this.MEDIUM_TERM_PERIOD,
            long: this.LONG_TERM_PERIOD
        };

        const result = {};

        for (const [term, period] of Object.entries(periods)) {
            const relevantData = historicalData.slice(0, period);
            if (relevantData.length < period) {
                result[term] = null;
                continue;
            }

            const lowest = Math.min(...relevantData.map(d => d.low));
            result[term] = {
                price: lowest,
                distance: relevantData[0].close - lowest,
                percentage: ((relevantData[0].close - lowest) / relevantData[0].close) * 100
            };
        }

        return result;
    }

    calculateTechnicalStops(currentPrice, technical) {
        const result = {
            support: null,
            resistance: null,
            moving_average: null
        };

        if (technical.supportLevels?.length > 0) {
            const nearestSupport = technical.supportLevels[0];
            result.support = {
                price: nearestSupport * (1 - this.SUPPORT_BUFFER),
                distance: currentPrice - (nearestSupport * (1 - this.SUPPORT_BUFFER)),
                percentage: this.SUPPORT_BUFFER * 100
            };
        }

        if (technical.resistanceLevels?.length > 0) {
            const nearestResistance = technical.resistanceLevels[0];
            result.resistance = {
                price: nearestResistance * (1 + this.RESISTANCE_BUFFER),
                distance: (nearestResistance * (1 + this.RESISTANCE_BUFFER)) - currentPrice,
                percentage: this.RESISTANCE_BUFFER * 100
            };
        }

        if (technical.sma?.value) {
            result.moving_average = {
                price: technical.sma.value,
                distance: currentPrice - technical.sma.value,
                percentage: ((currentPrice - technical.sma.value) / currentPrice) * 100
            };
        }

        return result;
    }

    calculateVolatilityStops(currentPrice, historicalData) {
        const volatility = this.calculateHistoricalVolatility(historicalData);
        
        return {
            price: currentPrice * (1 - volatility),
            distance: currentPrice * volatility,
            percentage: volatility * 100,
            volatilityLevel: this.determineVolatilityLevel(volatility)
        };
    }

    calculatePatternStops(currentPrice, patterns) {
        const result = {};

        if (!Array.isArray(patterns)) {
            return null;
        }

        for (const pattern of patterns) {
            if (!pattern || !pattern.type) continue;
            
            const config = this.PATTERN_MULTIPLIERS[pattern.type];
            if (config && pattern.confidence >= config.confidence_threshold) {
                result[pattern.type.toLowerCase()] = {
                    price: currentPrice * (1 - (pattern.stopLoss * config.multiplier)),
                    distance: currentPrice * pattern.stopLoss * config.multiplier,
                    percentage: pattern.stopLoss * config.multiplier * 100,
                    confidence: pattern.confidence
                };
            }
        }

        return Object.keys(result).length > 0 ? result : null;
    }

    calculateRecommendedStop(stops, trend) {
        // Implement logic to select the most appropriate stop loss level
        // based on current market conditions and analysis
        const candidates = [];

        if (stops.atr?.normal) {
            candidates.push({
                price: stops.atr.normal.price,
                source: 'ATR',
                weight: 1.0
            });
        }

        if (stops.technical?.support) {
            candidates.push({
                price: stops.technical.support.price,
                source: 'Technical',
                weight: 0.8
            });
        }

        if (stops.volatility) {
            candidates.push({
                price: stops.volatility.price,
                source: 'Volatility',
                weight: 0.6
            });
        }

        if (candidates.length === 0) {
            return null;
        }

        // Weight the candidates based on trend
        if (trend) {
            candidates.forEach(c => {
                if (trend === 'UPTREND') {
                    c.weight *= 1.2;
                } else if (trend === 'DOWNTREND') {
                    c.weight *= 0.8;
                }
            });
        }

        // Select the highest weighted stop level
        const selected = candidates.reduce((prev, curr) => 
            prev.weight > curr.weight ? prev : curr
        );

        return {
            price: selected.price,
            source: selected.source,
            confidence: selected.weight
        };
    }

    calculateHistoricalVolatility(historicalData) {
        const returns = [];
        for (let i = 1; i < historicalData.length; i++) {
            returns.push(Math.log(historicalData[i].close / historicalData[i - 1].close));
        }

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    determineVolatilityLevel(volatility) {
        if (volatility >= this.HIGH_VOLATILITY_THRESHOLD) return 'HIGH';
        if (volatility <= this.LOW_VOLATILITY_THRESHOLD) return 'LOW';
        return 'MEDIUM';
    }
}

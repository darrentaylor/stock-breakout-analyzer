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

    /**
     * Calculate comprehensive stop loss levels
     * @param {Object} params - Parameters for stop loss calculation
     * @param {number} params.currentPrice - Current price of the asset
     * @param {number} params.atr - Average True Range value
     * @param {Object} params.technicalLevels - Support and resistance levels
     * @param {Object} params.patterns - Detected chart patterns
     * @param {Object} params.volatility - Volatility metrics
     * @returns {Object} Stop loss recommendations
     */
    calculateStopLoss(params) {
        try {
            const {
                currentPrice,
                atr,
                technicalLevels,
                patterns,
                volatility
            } = params;

            // 1. Technical Stop Levels
            const technicalStops = this.calculateTechnicalStops({
                currentPrice,
                support: technicalLevels.support,
                resistance: technicalLevels.resistance,
                patterns
            });

            // 2. Volatility-Based Stops (ATR)
            const volatilityStops = this.calculateVolatilityStops({
                currentPrice,
                atr,
                volatility
            });

            // 3. Time-Based Stops
            const timeBasedStops = this.calculateTimeBasedStops({
                currentPrice,
                atr,
                volatility
            });

            // 4. Pattern-Specific Stops
            const patternStops = this.calculatePatternStops({
                currentPrice,
                patterns,
                atr
            });

            // 5. Trailing Stops
            const trailingStops = this.calculateTrailingStops({
                currentPrice,
                atr,
                volatility,
                patterns
            });

            // Combine all stop types and determine optimal levels
            return this.consolidateStopLevels({
                technical: technicalStops,
                volatility: volatilityStops,
                timeBased: timeBasedStops,
                pattern: patternStops,
                trailing: trailingStops,
                currentPrice,
                atr
            });
        } catch (error) {
            logger.error('Error calculating stop loss:', error);
            throw error;
        }
    }

    /**
     * Calculate stops based on technical levels
     */
    calculateTechnicalStops({ currentPrice, support, resistance, patterns }) {
        const stops = {
            support_based: null,
            resistance_based: null,
            pattern_based: null
        };

        // Support-based stop for long positions
        if (support) {
            stops.support_based = support * (1 - this.SUPPORT_BUFFER);
        }

        // Resistance-based stop for short positions
        if (resistance) {
            stops.resistance_based = resistance * (1 + this.RESISTANCE_BUFFER);
        }

        return stops;
    }

    /**
     * Calculate volatility-based (ATR) stops
     */
    calculateVolatilityStops({ currentPrice, atr, volatility }) {
        const volatilityRatio = atr / currentPrice;
        let multiplier;

        if (volatilityRatio >= this.HIGH_VOLATILITY_THRESHOLD) {
            multiplier = this.WIDE_ATR_MULTIPLIER;
        } else if (volatilityRatio <= this.LOW_VOLATILITY_THRESHOLD) {
            multiplier = this.TIGHT_ATR_MULTIPLIER;
        } else {
            multiplier = this.NORMAL_ATR_MULTIPLIER;
        }

        return {
            tight: currentPrice - (atr * this.TIGHT_ATR_MULTIPLIER),
            normal: currentPrice - (atr * this.NORMAL_ATR_MULTIPLIER),
            wide: currentPrice - (atr * this.WIDE_ATR_MULTIPLIER),
            recommended: currentPrice - (atr * multiplier)
        };
    }

    /**
     * Calculate time-based stops
     */
    calculateTimeBasedStops({ currentPrice, atr, volatility }) {
        return {
            short_term: {
                initial: currentPrice - (atr * 1.5),
                trailing: true,
                period: this.SHORT_TERM_PERIOD
            },
            medium_term: {
                initial: currentPrice - (atr * 2.0),
                trailing: true,
                period: this.MEDIUM_TERM_PERIOD
            },
            long_term: {
                initial: currentPrice - (atr * 2.5),
                trailing: true,
                period: this.LONG_TERM_PERIOD
            }
        };
    }

    /**
     * Calculate pattern-specific stops
     */
    calculatePatternStops({ currentPrice, patterns, atr }) {
        const stops = {
            pattern_specific: null,
            confidence: 0
        };

        if (patterns?.dominantPattern) {
            const { type, confidence } = patterns.dominantPattern;
            
            switch (type) {
                case 'HEAD_AND_SHOULDERS':
                    stops.pattern_specific = currentPrice - (atr * 1.5);
                    break;
                case 'DOUBLE_BOTTOM':
                    stops.pattern_specific = currentPrice - (atr * 2.0);
                    break;
                case 'TRIANGLE':
                    stops.pattern_specific = currentPrice - (atr * 1.75);
                    break;
                default:
                    stops.pattern_specific = currentPrice - (atr * 2.0);
            }
            
            stops.confidence = confidence;
        }

        return stops;
    }

    /**
     * Calculate trailing stops
     */
    calculateTrailingStops({ currentPrice, atr, volatility, patterns }) {
        const baseTrailingDistance = atr * this.NORMAL_ATR_MULTIPLIER;
        const volatilityAdjustment = this.calculateVolatilityAdjustment(volatility);
        const patternAdjustment = this.calculatePatternAdjustment(patterns);

        // Adjust trailing distance based on market conditions
        const adjustedDistance = baseTrailingDistance * volatilityAdjustment * patternAdjustment;

        return {
            distance: adjustedDistance,
            activation_threshold: currentPrice * (1 + this.TRAILING_ACTIVATION_THRESHOLD),
            step_size: adjustedDistance * this.TRAILING_STEP_SIZE,
            adjustment_factors: {
                volatility: volatilityAdjustment,
                pattern: patternAdjustment
            }
        };
    }

    /**
     * Calculate volatility adjustment for trailing stops
     */
    calculateVolatilityAdjustment(volatility) {
        const volatilityRatio = volatility.value || 0;
        
        if (volatilityRatio >= this.HIGH_VOLATILITY_THRESHOLD) {
            return 1.5; // Wider trailing stop in high volatility
        } else if (volatilityRatio <= this.LOW_VOLATILITY_THRESHOLD) {
            return 0.8; // Tighter trailing stop in low volatility
        }
        return 1.0;
    }

    /**
     * Calculate pattern adjustment for trailing stops
     */
    calculatePatternAdjustment(patterns) {
        if (!patterns?.dominantPattern) return 1.0;

        const { type, confidence } = patterns.dominantPattern;
        const patternConfig = this.PATTERN_MULTIPLIERS[type];

        if (!patternConfig) return 1.0;

        if (confidence >= patternConfig.confidence_threshold) {
            return patternConfig.multiplier;
        }
        
        // Scale multiplier based on confidence if below threshold
        return 1.0 + (patternConfig.multiplier - 1.0) * (confidence / patternConfig.confidence_threshold);
    }

    /**
     * Consolidate all stop types and provide final recommendations
     */
    consolidateStopLevels({
        technical,
        volatility,
        timeBased,
        pattern,
        trailing,
        currentPrice,
        atr
    }) {
        const recommendations = {
            conservative: {
                initial: Math.min(
                    technical.support_based || Infinity,
                    volatility.wide,
                    timeBased.long_term.initial,
                    pattern.pattern_specific || Infinity
                ),
                trailing: true,
                timeframe: 'LONG_TERM',
                risk_percent: ((currentPrice - volatility.wide) / currentPrice) * 100
            },
            moderate: {
                initial: Math.min(
                    volatility.normal,
                    timeBased.medium_term.initial,
                    pattern.pattern_specific || Infinity
                ),
                trailing: true,
                timeframe: 'MEDIUM_TERM',
                risk_percent: ((currentPrice - volatility.normal) / currentPrice) * 100
            },
            aggressive: {
                initial: Math.min(
                    volatility.tight,
                    timeBased.short_term.initial
                ),
                trailing: true,
                timeframe: 'SHORT_TERM',
                risk_percent: ((currentPrice - volatility.tight) / currentPrice) * 100
            }
        };

        // Determine optimal stop based on market conditions
        const optimalStop = this.determineOptimalStop({
            recommendations,
            pattern,
            volatility,
            currentPrice,
            atr,
            trailing
        });

        return {
            recommendations,
            optimal: optimalStop,
            technical_levels: technical,
            volatility_based: volatility,
            time_based: timeBased,
            pattern_based: pattern,
            trailing_stop: trailing
        };
    }

    /**
     * Determine the optimal stop loss based on all factors
     */
    determineOptimalStop({
        recommendations,
        pattern,
        volatility,
        currentPrice,
        atr,
        trailing
    }) {
        let optimal;

        // Use pattern-based stop if available and confident
        if (pattern.confidence > 0.7) {
            optimal = recommendations.conservative;
        }
        // Use wider stops in high volatility
        else if (atr / currentPrice >= this.HIGH_VOLATILITY_THRESHOLD) {
            optimal = recommendations.conservative;
        }
        // Use tighter stops in low volatility
        else if (atr / currentPrice <= this.LOW_VOLATILITY_THRESHOLD) {
            optimal = recommendations.aggressive;
        }
        // Default to moderate stops
        else {
            optimal = recommendations.moderate;
        }

        // Adjust optimal stop based on trailing stop conditions
        if (trailing.activation_threshold <= currentPrice) {
            optimal.trailing = true;
            optimal.initial = Math.max(optimal.initial, currentPrice - trailing.distance);
        }

        return {
            ...optimal,
            reason: this.getOptimalStopReason(pattern, volatility, currentPrice, atr)
        };
    }

    /**
     * Get the reasoning behind the optimal stop selection
     */
    getOptimalStopReason(pattern, volatility, currentPrice, atr) {
        if (pattern.confidence > 0.7) {
            return 'HIGH_CONFIDENCE_PATTERN';
        } else if (atr / currentPrice >= this.HIGH_VOLATILITY_THRESHOLD) {
            return 'HIGH_VOLATILITY';
        } else if (atr / currentPrice <= this.LOW_VOLATILITY_THRESHOLD) {
            return 'LOW_VOLATILITY';
        }
        return 'BALANCED_CONDITIONS';
    }
}

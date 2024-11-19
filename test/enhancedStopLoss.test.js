import { StopLossService } from '../src/services/StopLossService.js';
import { RiskManager } from '../src/services/RiskManager.js';
import { expect } from 'chai';

describe('Enhanced Stop Loss Strategy Tests', () => {
    let stopLossService;
    let riskManager;

    beforeEach(() => {
        stopLossService = new StopLossService();
        riskManager = new RiskManager();
    });

    describe('Pattern-Specific Stop Tests', () => {
        it('should calculate pattern-specific stops with confidence scaling', () => {
            const params = {
                currentPrice: 100,
                atr: 2,
                patterns: {
                    dominantPattern: {
                        type: 'HEAD_AND_SHOULDERS',
                        confidence: 0.8
                    }
                }
            };

            const result = stopLossService.calculatePatternStops(params);
            expect(result.pattern_specific).to.be.a('number');
            expect(result.confidence).to.equal(0.8);
        });

        it('should adjust stops based on pattern confidence', () => {
            const params = {
                currentPrice: 100,
                atr: 2,
                patterns: {
                    dominantPattern: {
                        type: 'TRIANGLE',
                        confidence: 0.6 // Below threshold
                    }
                }
            };

            const adjustment = stopLossService.calculatePatternAdjustment(params.patterns);
            expect(adjustment).to.be.lessThan(stopLossService.PATTERN_MULTIPLIERS.TRIANGLE.multiplier);
        });
    });

    describe('Trailing Stop Tests', () => {
        it('should calculate trailing stops with market condition adjustments', () => {
            const params = {
                currentPrice: 100,
                atr: 2,
                volatility: { value: 0.02 },
                patterns: {
                    dominantPattern: {
                        type: 'TRIANGLE',
                        confidence: 0.7
                    }
                }
            };

            const result = stopLossService.calculateTrailingStops(params);
            expect(result).to.have.property('distance');
            expect(result).to.have.property('activation_threshold');
            expect(result).to.have.property('step_size');
            expect(result.adjustment_factors).to.have.property('volatility');
            expect(result.adjustment_factors).to.have.property('pattern');
        });

        it('should adjust trailing stops in high volatility', () => {
            const params = {
                currentPrice: 100,
                atr: 4,
                volatility: { value: 0.04 }, // High volatility
                patterns: {}
            };

            const result = stopLossService.calculateTrailingStops(params);
            expect(result.adjustment_factors.volatility).to.equal(1.5);
        });
    });

    describe('Risk Manager Integration Tests', () => {
        it('should calculate dynamic position size based on confidence', () => {
            const params = {
                capital: 100000,
                currentPrice: 100,
                confidence: 'HIGH_CONFIDENCE',
                technicalData: {
                    atr: { value: 2 },
                    levels: {
                        support: 95,
                        resistance: 105
                    },
                    patterns: {
                        dominantPattern: {
                            type: 'TRIANGLE',
                            confidence: 0.8
                        }
                    },
                    volatility: { value: 0.02 }
                }
            };

            const positionSize = riskManager.calculateDynamicPositionSize(params);
            expect(positionSize).to.be.a('number');
            expect(positionSize).to.be.greaterThan(0);
        });

        it('should generate comprehensive trade plan', () => {
            const analysis = {
                signals: {
                    entry_points: { conservative: 100 },
                    targets: [105, 110, 115],
                    trend_strength: 0.7,
                    volume_confirmation: true
                },
                technicalData: {
                    atr: { value: 2 },
                    levels: {
                        support: 95,
                        resistance: 105
                    },
                    patterns: {
                        dominantPattern: {
                            type: 'TRIANGLE',
                            confidence: 0.8
                        }
                    },
                    volatility: { value: 0.02 }
                },
                patterns: {
                    dominantPattern: {
                        type: 'TRIANGLE',
                        confidence: 0.8
                    }
                },
                volatility: { value: 0.02 }
            };

            const tradePlan = riskManager.generateTradePlan(analysis);
            expect(tradePlan).to.have.property('position_size');
            expect(tradePlan).to.have.property('risk_reward');
            expect(tradePlan.stop_loss).to.have.property('trailing');
            expect(tradePlan).to.have.property('confidence');
            expect(tradePlan).to.have.property('risk_metrics');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle missing pattern data gracefully', () => {
            const params = {
                currentPrice: 100,
                atr: 2,
                technicalLevels: {
                    support: 95,
                    resistance: 105
                },
                patterns: null,
                volatility: { value: 0.02 }
            };

            const result = stopLossService.calculateStopLoss(params);
            expect(result).to.have.property('recommendations');
            expect(result).to.have.property('optimal');
        });

        it('should handle extreme volatility values', () => {
            const params = {
                currentPrice: 100,
                atr: 10, // Very high ATR
                technicalLevels: {
                    support: 95,
                    resistance: 105
                },
                patterns: {},
                volatility: { value: 0.1 } // Extreme volatility
            };

            const result = stopLossService.calculateStopLoss(params);
            expect(result.optimal.reason).to.equal('HIGH_VOLATILITY');
        });
    });
});

import { StopLossService } from '../src/services/StopLossService.js';
import { EntryAnalyzer } from '../src/services/EntryAnalyzer.js';
import { expect } from 'chai';

describe('Stop Loss Strategy Tests', () => {
    let stopLossService;
    let entryAnalyzer;

    beforeEach(() => {
        stopLossService = new StopLossService();
        entryAnalyzer = new EntryAnalyzer();
    });

    describe('StopLossService Tests', () => {
        it('should calculate volatility-based stops correctly', () => {
            const currentPrice = 100;
            const atr = 2;
            const result = stopLossService.calculateVolatilityStops({
                currentPrice,
                atr,
                volatility: { value: 0.02 }
            });

            expect(result).to.have.property('tight');
            expect(result).to.have.property('normal');
            expect(result).to.have.property('wide');
            expect(result.tight).to.equal(currentPrice - (atr * stopLossService.TIGHT_ATR_MULTIPLIER));
            expect(result.normal).to.equal(currentPrice - (atr * stopLossService.NORMAL_ATR_MULTIPLIER));
            expect(result.wide).to.equal(currentPrice - (atr * stopLossService.WIDE_ATR_MULTIPLIER));
        });

        it('should calculate technical stops based on support/resistance', () => {
            const params = {
                currentPrice: 100,
                support: 95,
                resistance: 105,
                patterns: {}
            };

            const result = stopLossService.calculateTechnicalStops(params);
            expect(result.support_based).to.be.closeTo(94.525, 0.001); // 95 * (1 - 0.005)
            expect(result.resistance_based).to.be.closeTo(105.525, 0.001); // 105 * (1 + 0.005)
        });

        it('should calculate pattern-specific stops', () => {
            const params = {
                currentPrice: 100,
                patterns: {
                    dominantPattern: {
                        type: 'HEAD_AND_SHOULDERS',
                        confidence: 0.8
                    }
                },
                atr: 2
            };

            const result = stopLossService.calculatePatternStops(params);
            expect(result.pattern_specific).to.equal(97); // 100 - (2 * 1.5)
            expect(result.confidence).to.equal(0.8);
        });

        it('should provide comprehensive stop loss recommendations', () => {
            const params = {
                currentPrice: 100,
                atr: 2,
                technicalLevels: {
                    support: 95,
                    resistance: 105
                },
                patterns: {
                    dominantPattern: {
                        type: 'TRIANGLE',
                        confidence: 0.75
                    }
                },
                volatility: { value: 0.02 }
            };

            const result = stopLossService.calculateStopLoss(params);
            
            expect(result).to.have.property('recommendations');
            expect(result).to.have.property('optimal');
            expect(result.recommendations).to.have.property('conservative');
            expect(result.recommendations).to.have.property('moderate');
            expect(result.recommendations).to.have.property('aggressive');
            expect(result.optimal).to.have.property('reason');
        });

        it('should handle high volatility scenarios', () => {
            const params = {
                currentPrice: 100,
                atr: 4, // 4% ATR indicates high volatility
                technicalLevels: {
                    support: 95,
                    resistance: 105
                },
                patterns: {},
                volatility: { value: 0.04 }
            };

            const result = stopLossService.calculateStopLoss(params);
            expect(result.optimal.reason).to.equal('HIGH_VOLATILITY');
            expect(result.optimal.timeframe).to.equal('LONG_TERM');
        });

        it('should handle low volatility scenarios', () => {
            const params = {
                currentPrice: 100,
                atr: 0.5, // 0.5% ATR indicates low volatility
                technicalLevels: {
                    support: 95,
                    resistance: 105
                },
                patterns: {},
                volatility: { value: 0.005 }
            };

            const result = stopLossService.calculateStopLoss(params);
            expect(result.optimal.reason).to.equal('LOW_VOLATILITY');
            expect(result.optimal.timeframe).to.equal('SHORT_TERM');
        });
    });

    describe('EntryAnalyzer Integration Tests', () => {
        it('should calculate risk-reward ratio correctly', () => {
            const currentPrice = 100;
            const stopLevel = 95;
            const target = 110;

            const ratio = entryAnalyzer.calculateRiskRewardRatio(currentPrice, stopLevel, target);
            expect(ratio).to.equal(2); // (110-100)/(100-95) = 2
        });

        it('should integrate stop loss calculations in entry analysis', () => {
            const marketData = [
                { close: 98, volume: 1000 },
                { close: 99, volume: 1100 },
                { close: 100, volume: 1200 }
            ];

            const technicalData = {
                atr: { value: 2 },
                patterns: {
                    dominantPattern: {
                        type: 'TRIANGLE',
                        confidence: 0.8
                    }
                },
                volatility: { value: 0.02 },
                targets: {
                    primary: 110
                }
            };

            const result = entryAnalyzer.analyzeEntryPoints(marketData, technicalData);
            expect(result).to.have.property('riskRewardRatio');
            expect(result.riskRewardRatio).to.be.a('number');
        });
    });
});

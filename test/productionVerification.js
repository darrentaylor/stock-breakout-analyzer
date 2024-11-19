import { MarketDataService } from '../src/services/MarketDataService.js';
import { TechnicalAnalysis } from '../src/utils/TechnicalAnalysis.js';
import { PatternRecognitionService } from '../src/services/PatternRecognitionService.js';
import { StopLossService } from '../src/services/StopLossService.js';
import { RiskManager } from '../src/services/RiskManager.js';
import { logger } from '../src/utils/logger.js';
import { AlphaVantageService } from '../src/services/AlphaVantageService.js';

class ProductionVerification {
    constructor() {
        this.alphaVantageService = new AlphaVantageService();
        this.marketDataService = new MarketDataService(this.alphaVantageService);
        this.technicalAnalysis = new TechnicalAnalysis();
        this.patternRecognition = new PatternRecognitionService();
        this.stopLossService = new StopLossService();
        this.riskManager = new RiskManager();
    }

    async verifyStopLossStrategies() {
        try {
            // Test symbols with different volatility profiles
            const symbols = ['AAPL', 'MSFT', 'TSLA', 'VIX'];
            const results = [];

            for (const symbol of symbols) {
                logger.info(`Testing stop loss strategies for ${symbol}`);
                
                try {
                    // Fetch market data
                    const marketData = await this.marketDataService.getHistoricalData(symbol);
                    if (!marketData || marketData.length === 0) {
                        logger.error(`No market data available for ${symbol}`);
                        continue;
                    }

                    // Calculate technical indicators
                    const technicalData = this.technicalAnalysis.analyze(marketData);
                    
                    // Detect patterns
                    const patterns = this.patternRecognition.analyzePatterns(marketData);

                    // Current market conditions
                    const currentPrice = marketData[marketData.length - 1].close;
                    const volatility = this.calculateVolatility(marketData);

                    // Calculate stop losses
                    const stopLossLevels = this.stopLossService.calculateStopLoss({
                        currentPrice,
                        atr: technicalData.atr.value,
                        technicalLevels: {
                            support: technicalData.support,
                            resistance: technicalData.resistance
                        },
                        patterns,
                        volatility
                    });

                    // Generate trade plan
                    const tradePlan = this.riskManager.generateTradePlan({
                        signals: {
                            entry_points: { conservative: currentPrice },
                            targets: this.calculateTargets(currentPrice, technicalData),
                            trend_strength: technicalData.trend.strength,
                            volume_confirmation: technicalData.volume.confirmation
                        },
                        technicalData: {
                            ...technicalData,
                            patterns,
                            volatility
                        },
                        patterns,
                        volatility
                    });

                    // Analyze results
                    const analysis = this.analyzeResults(symbol, {
                        marketData,
                        technicalData,
                        patterns,
                        stopLossLevels,
                        tradePlan
                    });

                    results.push(analysis);
                    logger.info(`Completed analysis for ${symbol}`);
                } catch (error) {
                    logger.error(`Error processing ${symbol}:`, error);
                    results.push({
                        symbol,
                        timestamp: new Date().toISOString(),
                        validation_status: 'ERROR',
                        error: error.message
                    });
                }
            }

            // Generate summary report
            return this.generateReport(results);

        } catch (error) {
            logger.error('Error during production verification:', error);
            throw error;
        }
    }

    calculateVolatility(marketData) {
        const returns = [];
        for (let i = 1; i < marketData.length; i++) {
            returns.push((marketData[i].close - marketData[i-1].close) / marketData[i-1].close);
        }
        const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
        return { value: volatility };
    }

    calculateTargets(currentPrice, technicalData) {
        const atr = technicalData.atr.value;
        return [
            currentPrice + (atr * 1.5),  // Conservative target
            currentPrice + (atr * 2.5),  // Moderate target
            currentPrice + (atr * 3.5)   // Aggressive target
        ];
    }

    analyzeResults(symbol, data) {
        const { marketData, technicalData, patterns, stopLossLevels, tradePlan } = data;
        const currentPrice = marketData[marketData.length - 1].close;

        // Calculate key metrics
        const volatilityRatio = technicalData.atr.value / currentPrice;
        const stopDistancePercent = ((currentPrice - stopLossLevels.optimal.initial) / currentPrice) * 100;
        const riskRewardRatio = tradePlan.risk_reward;

        // Validate stop levels
        const stopValidation = this.validateStopLevels(stopLossLevels, currentPrice, technicalData);

        return {
            symbol,
            timestamp: new Date().toISOString(),
            market_conditions: {
                price: currentPrice,
                volatility_ratio: volatilityRatio,
                trend_strength: technicalData.trend.strength,
                pattern_detected: patterns?.dominantPattern?.type || 'NONE'
            },
            stop_loss_analysis: {
                optimal_stop: stopLossLevels.optimal,
                stop_distance_percent: stopDistancePercent,
                validation: stopValidation
            },
            risk_analysis: {
                risk_reward_ratio: riskRewardRatio,
                position_size: tradePlan.position_size,
                capital_at_risk: tradePlan.risk_metrics.capital_at_risk
            },
            validation_status: this.getValidationStatus(stopValidation, riskRewardRatio)
        };
    }

    validateStopLevels(stopLevels, currentPrice, technicalData) {
        const validation = {
            status: true,
            issues: []
        };

        // Validate stop distance
        const stopDistance = (currentPrice - stopLevels.optimal.initial) / currentPrice;
        if (stopDistance < 0.005) { // Less than 0.5%
            validation.status = false;
            validation.issues.push('STOP_TOO_CLOSE');
        }
        if (stopDistance > 0.1) { // More than 10%
            validation.status = false;
            validation.issues.push('STOP_TOO_FAR');
        }

        // Validate against support levels
        if (stopLevels.optimal.initial < technicalData.support * 0.995) {
            validation.status = false;
            validation.issues.push('STOP_BELOW_SUPPORT');
        }

        // Validate trailing stop parameters
        if (stopLevels.trailing_stop) {
            const trailingDistance = stopLevels.trailing_stop.distance / currentPrice;
            if (trailingDistance < 0.003) { // Less than 0.3%
                validation.status = false;
                validation.issues.push('TRAILING_STOP_TOO_TIGHT');
            }
        }

        return validation;
    }

    getValidationStatus(stopValidation, riskRewardRatio) {
        if (!stopValidation.status || stopValidation.issues.length > 0) {
            return 'FAILED';
        }
        if (riskRewardRatio < 1.5) {
            return 'SUBOPTIMAL';
        }
        return 'PASSED';
    }

    generateReport(results) {
        const summary = {
            total_symbols: results.length,
            passed: results.filter(r => r.validation_status === 'PASSED').length,
            failed: results.filter(r => r.validation_status === 'FAILED').length,
            suboptimal: results.filter(r => r.validation_status === 'SUBOPTIMAL').length,
            average_risk_reward: results.reduce((sum, r) => sum + r.risk_analysis.risk_reward_ratio, 0) / results.length,
            timestamp: new Date().toISOString()
        };

        logger.info('Production Verification Summary:', summary);
        logger.info('Detailed Results:', JSON.stringify(results, null, 2));

        return {
            summary,
            detailed_results: results
        };
    }
}

// Run verification
const verifier = new ProductionVerification();
verifier.verifyStopLossStrategies()
    .then(report => {
        logger.info('Production verification completed');
        logger.info('Summary Report:', report.summary);
        
        // Log detailed analysis for failed cases
        const failedCases = report.detailed_results.filter(r => 
            r.validation_status === 'FAILED' || r.validation_status === 'ERROR'
        );
        if (failedCases.length > 0) {
            logger.warn('Failed Cases:', failedCases);
        }
    })
    .catch(error => logger.error('Production verification failed:', error));

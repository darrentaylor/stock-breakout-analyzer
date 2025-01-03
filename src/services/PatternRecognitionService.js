class PatternRecognitionService {
    constructor() {
        this.minPatternBars = 5;  // Minimum bars needed to form a pattern
        this.maxPatternBars = 30; // Maximum bars to look back for pattern formation
        this.priceDeviation = 0.02; // 2% deviation allowed for pattern recognition
    }

    async analyze(data) {
        return this.analyzePatterns(data);
    }

    /**
     * Analyzes price data for various chart patterns
     * @param {Array} data - Array of price data objects with OHLC values
     * @returns {Object} Pattern analysis results
     */
    analyzePatterns(data) {
        if (!data || data.length < this.minPatternBars) {
            return {
                patterns: {},
                summary: {
                    detected: false,
                    message: 'Insufficient data for pattern analysis'
                }
            };
        }

        const patterns = {
            bullFlag: this.detectBullFlag(data),
            bearFlag: this.detectBearFlag(data),
            pennant: this.detectPennant(data),
            triangle: this.detectTriangle(data),
            headAndShoulders: this.detectHeadAndShoulders(data)
        };

        // Add confidence scores and stop loss levels
        Object.entries(patterns).forEach(([type, pattern]) => {
            if (pattern.detected) {
                pattern.type = type;
                pattern.confidence = this.calculatePatternConfidence(pattern, data);
                pattern.stopLoss = this.calculatePatternStopLoss(pattern, data);
            }
        });

        return {
            patterns: Object.entries(patterns)
                .filter(([_, pattern]) => pattern.detected)
                .map(([type, pattern]) => ({
                    type,
                    confidence: pattern.confidence,
                    stopLoss: pattern.stopLoss,
                    details: pattern
                })),
            summary: this.generatePatternSummary(patterns)
        };
    }

    calculatePatternConfidence(pattern, data) {
        // Base confidence from pattern detection
        let confidence = pattern.strength || 0.5;

        // Adjust based on volume confirmation
        if (pattern.volumeConfirmation) {
            confidence += 0.1;
        }

        // Adjust based on trend strength
        if (pattern.trendStrength > 0.7) {
            confidence += 0.2;
        }

        // Adjust based on pattern clarity
        if (pattern.priceDeviation < this.priceDeviation) {
            confidence += 0.1;
        }

        // Cap confidence at 1.0
        return Math.min(confidence, 1.0);
    }

    calculatePatternStopLoss(pattern, data) {
        const currentPrice = data[0].close;
        let stopLossLevel;

        switch (pattern.type) {
            case 'bullFlag':
            case 'pennant':
                // Use the lowest low of the consolidation period
                stopLossLevel = Math.min(...data.slice(0, pattern.consolidation?.length || 5).map(d => d.low));
                break;

            case 'bearFlag':
                // Use the highest high of the consolidation period
                stopLossLevel = Math.max(...data.slice(0, pattern.consolidation?.length || 5).map(d => d.high));
                break;

            case 'triangle':
                // Use the last support level
                stopLossLevel = pattern.support || (currentPrice * 0.95);
                break;

            case 'headAndShoulders':
                // Use the neckline
                stopLossLevel = pattern.neckline || (currentPrice * 0.95);
                break;

            default:
                // Default to 5% below current price
                stopLossLevel = currentPrice * 0.95;
        }

        return Math.abs(currentPrice - stopLossLevel) / currentPrice;
    }

    generatePatternSummary(patterns) {
        const detectedPatterns = Object.entries(patterns).filter(([_, p]) => p.detected);
        
        if (detectedPatterns.length === 0) {
            return {
                detected: false,
                message: 'No significant patterns detected'
            };
        }

        const strongestPattern = detectedPatterns.reduce((prev, curr) => {
            return (curr[1].confidence > prev[1].confidence) ? curr : prev;
        });

        return {
            detected: true,
            primaryPattern: strongestPattern[0],
            confidence: strongestPattern[1].confidence,
            message: `Detected ${detectedPatterns.length} pattern(s). Primary pattern: ${strongestPattern[0]} with ${(strongestPattern[1].confidence * 100).toFixed(1)}% confidence`
        };
    }

    /**
     * Detects bullish flag pattern
     * Requirements:
     * 1. Strong uptrend (pole)
     * 2. Consolidation period with parallel channels
     * 3. Lower volume during consolidation
     */
    detectBullFlag(data) {
        const lookback = Math.min(this.maxPatternBars, data.length);
        const priceData = data.slice(0, lookback);
        
        // Check for strong uptrend before consolidation
        const uptrend = this.identifyUptrend(priceData);
        if (!uptrend.isValid) return { detected: false };

        // Check for consolidation after uptrend
        const consolidation = this.identifyConsolidation(priceData.slice(uptrend.length));
        if (!consolidation.isValid) return { detected: false };

        // Volume analysis
        const volumeDecline = this.checkVolumeDeclining(priceData.slice(uptrend.length));

        return {
            detected: true,
            strength: uptrend.strength,
            consolidation: consolidation,
            volumeConfirmation: volumeDecline,
            startIndex: 0,
            endIndex: uptrend.length + consolidation.length,
            type: 'BULL_FLAG'
        };
    }

    /**
     * Detects bearish flag pattern
     * Similar to bull flag but in downtrend
     */
    detectBearFlag(data) {
        const lookback = Math.min(this.maxPatternBars, data.length);
        const priceData = data.slice(0, lookback);
        
        // Check for strong downtrend before consolidation
        const downtrend = this.identifyDowntrend(priceData);
        if (!downtrend.isValid) return { detected: false };

        // Check for consolidation after downtrend
        const consolidation = this.identifyConsolidation(priceData.slice(downtrend.length));
        if (!consolidation.isValid) return { detected: false };

        // Volume analysis
        const volumeDecline = this.checkVolumeDeclining(priceData.slice(downtrend.length));

        return {
            detected: true,
            strength: downtrend.strength,
            consolidation: consolidation,
            volumeConfirmation: volumeDecline,
            startIndex: 0,
            endIndex: downtrend.length + consolidation.length,
            type: 'BEAR_FLAG'
        };
    }

    /**
     * Detects pennant pattern
     * Characteristics:
     * 1. Strong move (pole)
     * 2. Converging trendlines
     * 3. Decreasing volume
     */
    detectPennant(data) {
        const lookback = Math.min(this.maxPatternBars, data.length);
        const priceData = data.slice(0, lookback);
        
        // Check for strong initial move
        const trend = this.identifyStrongMove(priceData);
        if (!trend.isValid) return { detected: false };

        // Check for converging price action
        const convergence = this.identifyConvergence(priceData.slice(trend.length));
        if (!convergence.isValid) return { detected: false };

        return {
            detected: true,
            strength: trend.strength,
            convergence: convergence,
            volumeConfirmation: this.checkVolumeDeclining(priceData.slice(trend.length)),
            startIndex: 0,
            endIndex: trend.length + convergence.length,
            type: trend.direction === 'up' ? 'BULL_PENNANT' : 'BEAR_PENNANT'
        };
    }

    /**
     * Detects triangle patterns (ascending, descending, symmetric)
     */
    detectTriangle(data) {
        const lookback = Math.min(this.maxPatternBars, data.length);
        const priceData = data.slice(0, lookback);
        
        const { highs, lows } = this.getPriceLevels(priceData);
        const upperTrendline = this.calculateTrendline(highs);
        const lowerTrendline = this.calculateTrendline(lows);

        // Determine triangle type based on trendline slopes
        const type = this.determineTriangleType(upperTrendline.slope, lowerTrendline.slope);
        if (!type) return { detected: false };

        const convergencePoint = this.findConvergencePoint(upperTrendline, lowerTrendline);
        if (!convergencePoint.isValid) return { detected: false };

        return {
            detected: true,
            strength: (upperTrendline.r2 + lowerTrendline.r2) / 2,
            convergence: convergencePoint,
            support: convergencePoint.y,
            startIndex: 0,
            endIndex: lookback - 1,
            type
        };
    }

    /**
     * Detects head and shoulders pattern
     * Key points:
     * 1. Left shoulder
     * 2. Head (higher high)
     * 3. Right shoulder (similar height to left shoulder)
     * 4. Neckline (support level)
     */
    detectHeadAndShoulders(data) {
        const lookback = Math.min(this.maxPatternBars, data.length);
        const priceData = data.slice(0, lookback);
        
        // Find potential shoulders and head
        const peaks = this.findSignificantPeaks(priceData);
        if (peaks.length < 3) return { detected: false };

        // Validate head and shoulders formation
        const formation = this.validateHeadAndShoulders(peaks, priceData);
        if (!formation.isValid) return { detected: false };

        return {
            detected: true,
            strength: formation.symmetry,
            neckline: formation.neckline,
            volumeConfirmation: formation.volumePattern,
            startIndex: formation.startIndex,
            endIndex: formation.endIndex,
            type: 'HEAD_AND_SHOULDERS'
        };
    }

    // Helper methods
    identifyUptrend(data) {
        const prices = data.map(d => d.close);
        const slope = this.calculateTrendlineSlope(prices);
        const strength = this.calculateTrendStrength(prices);
        
        return {
            isValid: slope > 0 && strength > 0.7,
            strength,
            length: Math.floor(data.length * 0.3) // Use 30% of data for trend
        };
    }

    identifyDowntrend(data) {
        const prices = data.map(d => d.close);
        const slope = this.calculateTrendlineSlope(prices);
        const strength = this.calculateTrendStrength(prices);
        
        return {
            isValid: slope < 0 && strength > 0.7,
            strength: Math.abs(strength),
            length: Math.floor(data.length * 0.3)
        };
    }

    identifyConsolidation(data) {
        const prices = data.map(d => d.close);
        const highLow = this.getHighLow(prices);
        const priceRange = (highLow.high - highLow.low) / highLow.low;
        
        return {
            isValid: priceRange <= this.priceDeviation,
            quality: 1 - (priceRange / this.priceDeviation),
            length: Math.floor(data.length * 0.7)
        };
    }

    getHighLow(prices) {
        return {
            high: Math.max(...prices),
            low: Math.min(...prices)
        };
    }

    identifyStrongMove(data) {
        const prices = data.map(d => d.close);
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const direction = returns.reduce((sum, ret) => sum + ret, 0) > 0 ? 'up' : 'down';
        const strength = Math.abs(returns.reduce((sum, ret) => sum + ret, 0));
        
        return {
            isValid: strength > 0.1, // 10% move
            direction,
            strength,
            length: Math.floor(data.length * 0.3)
        };
    }

    identifyConvergence(data) {
        const { highs, lows } = this.getPriceLevels(data);
        const highTrend = this.calculateTrendlineSlope(highs);
        const lowTrend = this.calculateTrendlineSlope(lows);
        
        // For convergence, high trend should be negative and low trend positive
        const isConverging = highTrend < 0 && lowTrend > 0;
        const convergenceRate = Math.abs(highTrend - lowTrend);
        
        return {
            isValid: isConverging,
            quality: Math.min(1, convergenceRate / 0.01), // Normalize to 0-1
            length: data.length
        };
    }

    getPriceLevels(data) {
        return {
            highs: data.map(d => d.high),
            lows: data.map(d => d.low)
        };
    }

    calculateTrendlineSlope(prices) {
        const x = Array.from({length: prices.length}, (_, i) => i);
        const n = prices.length;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = prices.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * prices[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);
        
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    calculateTrendStrength(prices) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const positiveReturns = returns.filter(r => r > 0).length;
        return positiveReturns / returns.length;
    }

    checkVolumeDeclining(data) {
        const volumes = data.map(d => d.volume);
        const slope = this.calculateTrendlineSlope(volumes);
        return slope < 0;
    }

    calculateTrendline(prices) {
        const x = Array.from({length: prices.length}, (_, i) => i);
        const n = prices.length;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = prices.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * prices[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);
        const sumY2 = prices.reduce((a, b) => a + b * b, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Calculate R-squared
        const yMean = sumY / n;
        const ssTotal = prices.reduce((a, y) => a + Math.pow(y - yMean, 2), 0);
        const ssResidual = prices.reduce((a, y, i) => {
            const yPred = slope * x[i] + intercept;
            return a + Math.pow(y - yPred, 2);
        }, 0);
        const r2 = 1 - (ssResidual / ssTotal);
        
        return { slope, intercept, r2 };
    }

    findSignificantPeaks(data) {
        const prices = data.map(d => d.high);
        const peaks = [];
        const minPeakDistance = Math.floor(data.length / 10);
        
        for (let i = 1; i < prices.length - 1; i++) {
            if (prices[i] > prices[i-1] && prices[i] > prices[i+1]) {
                // Found a peak
                if (peaks.length === 0 || i - peaks[peaks.length - 1].index > minPeakDistance) {
                    peaks.push({
                        index: i,
                        price: prices[i]
                    });
                }
            }
        }
        
        return peaks;
    }

    validateHeadAndShoulders(peaks, data) {
        if (peaks.length < 3) return { isValid: false };
        
        // Find three highest peaks
        const sortedPeaks = [...peaks].sort((a, b) => b.price - a.price);
        const head = sortedPeaks[0];
        const shoulder1 = sortedPeaks[1];
        const shoulder2 = sortedPeaks[2];
        
        // Validate formation
        const shoulderDiff = Math.abs(shoulder1.price - shoulder2.price);
        const shoulderToHeadRatio = Math.abs(shoulder1.price - head.price) / head.price;
        
        // Check shoulder symmetry
        const symmetry = 1 - (shoulderDiff / head.price);
        
        // Find neckline
        const neckline = this.calculateNeckline(data, shoulder1.index, shoulder2.index);
        
        const isValid = shoulderToHeadRatio > 0.1 && // Head should be at least 10% higher than shoulders
                       symmetry > 0.8 && // Shoulders should be within 20% of each other
                       neckline.r2 > 0.7; // Strong neckline fit
        
        return {
            isValid,
            symmetry,
            necklineQuality: neckline.r2,
            volumePattern: this.validateVolume(data, [shoulder1.index, head.index, shoulder2.index]),
            startIndex: Math.min(shoulder1.index, shoulder2.index),
            endIndex: Math.max(shoulder1.index, shoulder2.index),
            neckline
        };
    }

    calculateNeckline(data, shoulder1Index, shoulder2Index) {
        // Find troughs between shoulders and head
        const trough1 = this.findTrough(data, shoulder1Index);
        const trough2 = this.findTrough(data, shoulder2Index);
        
        return this.calculateTrendline([data[trough1].low, data[trough2].low]);
    }

    findTrough(data, peakIndex) {
        let minIndex = peakIndex;
        let minPrice = data[peakIndex].low;
        
        // Look for lowest point after peak
        for (let i = peakIndex + 1; i < Math.min(data.length, peakIndex + 10); i++) {
            if (data[i].low < minPrice) {
                minPrice = data[i].low;
                minIndex = i;
            }
        }
        
        return minIndex;
    }

    validateVolume(data, patternIndices) {
        // Volume should be highest at left shoulder, decreasing at head, lowest at right shoulder
        const volumes = patternIndices.map(i => data[i].volume);
        return volumes[0] > volumes[1] && volumes[1] > volumes[2];
    }

    assessPriceAction(data) {
        const prices = data.map(d => d.close);
        const volatility = this.calculateVolatility(prices);
        const momentum = this.calculateMomentum(prices);
        
        return (1 - volatility) * 0.5 + momentum * 0.5; // Normalize to 0-1
    }

    calculateVolatility(prices) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push(Math.abs((prices[i] - prices[i-1]) / prices[i-1]));
        }
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        return Math.min(1, avgReturn / 0.02); // Normalize to 0-1, cap at 2% average return
    }

    calculateMomentum(prices) {
        const shortPeriod = Math.floor(prices.length / 3);
        const recentAvg = prices.slice(0, shortPeriod).reduce((a, b) => a + b, 0) / shortPeriod;
        const oldAvg = prices.slice(-shortPeriod).reduce((a, b) => a + b, 0) / shortPeriod;
        
        return Math.max(0, Math.min(1, (recentAvg - oldAvg) / oldAvg + 0.5));
    }

    determineTriangleType(upperSlope, lowerSlope) {
        // Symmetric triangle: slopes are roughly equal but opposite
        if (Math.abs(upperSlope + lowerSlope) < 0.001) {
            return 'SYMMETRIC_TRIANGLE';
        }
        
        // Ascending triangle: flat top, rising bottom
        if (Math.abs(upperSlope) < 0.001 && lowerSlope > 0) {
            return 'ASCENDING_TRIANGLE';
        }
        
        // Descending triangle: flat bottom, falling top
        if (Math.abs(lowerSlope) < 0.001 && upperSlope < 0) {
            return 'DESCENDING_TRIANGLE';
        }
        
        // Expanding triangle (broadening formation)
        if (upperSlope > 0 && lowerSlope < 0) {
            return 'EXPANDING_TRIANGLE';
        }
        
        return null;
    }

    findConvergencePoint(upperTrendline, lowerTrendline) {
        // Calculate intersection point
        const x = (lowerTrendline.intercept - upperTrendline.intercept) / 
                 (upperTrendline.slope - lowerTrendline.slope);
        
        // Calculate y value at intersection
        const y = upperTrendline.slope * x + upperTrendline.intercept;
        
        // Validate convergence point
        const isValid = x > 0 && x < this.maxPatternBars * 2;
        
        // Calculate quality based on R-squared values and convergence distance
        const quality = (upperTrendline.r2 + lowerTrendline.r2) / 2 * 
                       (1 - Math.min(x / (this.maxPatternBars * 2), 1));
        
        return {
            isValid,
            quality,
            x,
            y,
            upperR2: upperTrendline.r2,
            lowerR2: lowerTrendline.r2
        };
    }
}

// Export the class
export { PatternRecognitionService };

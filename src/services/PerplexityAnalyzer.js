import axios from 'axios';
import { logger } from '../utils/logger.js';

class PerplexityAnalyzer {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.perplexity.ai';
    }

    async getMarketContext(symbol) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model: "llama-3.1-sonar-small-128k-chat",
                    messages: [{
                        role: "system",
                        content: "You are a financial analyst providing real-time market analysis. Focus on current market conditions, news, and sentiment that could affect trading decisions."
                    }, {
                        role: "user",
                        content: `Analyze the current market conditions and news for ${symbol}. Focus on recent news, market sentiment, industry trends, macroeconomic factors, and potential catalysts or risks. Format your response with clear sections: News:, Sentiment:, Industry:, Macro:, Catalysts:, and Risks:`
                    }],
                    temperature: 0.2,
                    top_p: 0.9,
                    frequency_penalty: 1
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const responseText = response.data.choices[0].message.content;
            
            // Parse the response to extract relevant information
            const newsRegex = /News:(.*?)(?=Sentiment:|$)/s;
            const sentimentRegex = /Sentiment:(.*?)(?=Industry:|$)/s;
            const industryRegex = /Industry:(.*?)(?=Macro:|$)/s;
            const macroRegex = /Macro:(.*?)(?=Catalysts:|$)/s;
            const catalystsRegex = /Catalysts:(.*?)(?=Risks:|$)/s;
            const risksRegex = /Risks:(.*?)$/s;

            const news = (responseText.match(newsRegex)?.[1] || '').trim();
            const sentiment = (responseText.match(sentimentRegex)?.[1] || '').trim();
            const industry = (responseText.match(industryRegex)?.[1] || '').trim();
            const macro = (responseText.match(macroRegex)?.[1] || '').trim();
            const catalysts = (responseText.match(catalystsRegex)?.[1] || '').trim();
            const risks = (responseText.match(risksRegex)?.[1] || '').trim();

            // Convert the extracted text into structured data
            return {
                current_news: this.parseNews(news),
                market_sentiment: this.parseSentiment(sentiment),
                industry_analysis: this.parseIndustry(industry),
                macro_factors: this.parseMacro(macro),
                catalysts_and_risks: {
                    upcoming_catalysts: catalysts.split('\n').filter(Boolean).map(c => c.trim()),
                    potential_risks: risks.split('\n').filter(Boolean).map(r => r.trim()),
                    timeframe: this.determineTimeframe(catalysts + risks)
                }
            };
        } catch (error) {
            logger.error('Error fetching market context from Perplexity:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText
            });
            return this.getDefaultContext(symbol);
        }
    }

    parseNews(newsText) {
        if (!newsText) return [{
            headline: "No recent news available",
            impact: "NEUTRAL",
            significance: "LOW",
            summary: "Unable to fetch current news"
        }];

        const newsItems = newsText.split('\n').filter(Boolean);
        return newsItems.map(item => {
            const impact = item.toLowerCase().includes('positive') ? 'POSITIVE' :
                         item.toLowerCase().includes('negative') ? 'NEGATIVE' : 'NEUTRAL';
            const significance = item.toLowerCase().includes('significant') ? 'HIGH' :
                               item.toLowerCase().includes('moderate') ? 'MEDIUM' : 'LOW';
            return {
                headline: item,
                impact,
                significance,
                summary: item
            };
        });
    }

    parseSentiment(sentimentText) {
        const sentiment = sentimentText.toLowerCase();
        const overall = sentiment.includes('bullish') ? 'BULLISH' :
                       sentiment.includes('bearish') ? 'BEARISH' : 'NEUTRAL';
        
        // Extract confidence from text or default to moderate confidence
        const confidenceMatch = sentiment.match(/(\d+)%/);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 65;

        // Extract key factors
        const factors = sentimentText.split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
            .map(factor => factor.replace(/^[-•]\s*/, '').trim());

        return {
            overall,
            confidence,
            key_factors: factors.length > 0 ? factors : ["Market sentiment based on available indicators"]
        };
    }

    parseIndustry(industryText) {
        const trend = industryText.toLowerCase().includes('positive') ? 'POSITIVE' :
                     industryText.toLowerCase().includes('negative') ? 'NEGATIVE' : 'NEUTRAL';

        const developments = industryText.split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
            .map(dev => dev.replace(/^[-•]\s*/, '').trim());

        return {
            trend,
            key_developments: developments.length > 0 ? developments : ["No major industry developments reported"],
            peer_performance: "Industry performance data not available"
        };
    }

    parseMacro(macroText) {
        if (!macroText) return [{
            factor: "No macroeconomic data available",
            impact: "NEUTRAL",
            description: "Unable to fetch macroeconomic factors"
        }];

        const factors = macroText.split('\n').filter(Boolean);
        return factors.map(factor => {
            const impact = factor.toLowerCase().includes('positive') ? 'POSITIVE' :
                         factor.toLowerCase().includes('negative') ? 'NEGATIVE' : 'NEUTRAL';
            return {
                factor: factor.replace(/^[-•]\s*/, '').trim(),
                impact,
                description: factor
            };
        });
    }

    determineTimeframe(text) {
        const shortTermIndicators = ['immediate', 'short', 'near-term', 'current'];
        const longTermIndicators = ['long', 'future', 'extended', 'year'];
        
        text = text.toLowerCase();
        if (shortTermIndicators.some(indicator => text.includes(indicator))) {
            return 'SHORT_TERM';
        } else if (longTermIndicators.some(indicator => text.includes(indicator))) {
            return 'LONG_TERM';
        }
        return 'MEDIUM_TERM';
    }

    getDefaultContext(symbol) {
        return {
            current_news: [{
                headline: "Unable to fetch current news",
                impact: "NEUTRAL",
                significance: "LOW",
                summary: "Real-time market data temporarily unavailable"
            }],
            market_sentiment: {
                overall: "NEUTRAL",
                confidence: 50,
                key_factors: ["Data unavailable"]
            },
            industry_analysis: {
                trend: "NEUTRAL",
                key_developments: ["Data unavailable"],
                peer_performance: "Data unavailable"
            },
            macro_factors: [{
                factor: "Data unavailable",
                impact: "NEUTRAL",
                description: "Real-time market data temporarily unavailable"
            }],
            catalysts_and_risks: {
                upcoming_catalysts: ["Data unavailable"],
                potential_risks: ["Data unavailable"],
                timeframe: "SHORT_TERM"
            }
        };
    }

    async enhanceAnalysis(symbol, baseAnalysis) {
        try {
            const marketContext = await this.getMarketContext(symbol);
            
            // Create a new object with only the data we need
            const enhancedAnalysis = {
                ...baseAnalysis,
                real_time_context: marketContext,
                sentiment: {
                    ...baseAnalysis.sentiment,
                    market_context: {
                        current_sentiment: marketContext.market_sentiment.overall,
                        confidence: marketContext.market_sentiment.confidence,
                        key_factors: marketContext.market_sentiment.key_factors
                    }
                },
                analysis: {
                    ...baseAnalysis.analysis,
                    news_impact: {
                        recent_news: marketContext.current_news,
                        industry_trends: marketContext.industry_analysis,
                        macro_environment: marketContext.macro_factors
                    }
                }
            };

            // Add risk assessment if it exists
            if (baseAnalysis.analysis?.risk_assessment) {
                enhancedAnalysis.analysis.risk_assessment = {
                    ...baseAnalysis.analysis.risk_assessment,
                    real_time_risks: marketContext.catalysts_and_risks.potential_risks,
                    upcoming_catalysts: marketContext.catalysts_and_risks.upcoming_catalysts
                };
            }

            return enhancedAnalysis;
        } catch (error) {
            logger.error('Error enhancing analysis with Perplexity data:', {
                message: error.message,
                symbol: symbol
            });
            return baseAnalysis;
        }
    }
}

export { PerplexityAnalyzer };

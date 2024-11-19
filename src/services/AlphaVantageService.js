export class AlphaVantageService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://www.alphavantage.co/query';
        this.rateLimit = 5;
        this.lastCall = 0;
        this.fetch = null;
    }

    async init() {
        const { default: fetch } = await import('node-fetch');
        this.fetch = fetch;
    }

    async fetchIntraday(symbol, interval = '5min') {
        await this._checkRateLimit();
        const url = `${this.baseUrl}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${this.apiKey}`;
        return this._makeRequest(url);
    }

    async fetchDaily(symbol) {
        await this._checkRateLimit();
        const url = `${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${this.apiKey}`;
        return this._makeRequest(url);
    }

    async _makeRequest(url) {
        if (!this.fetch) await this.init();
        try {
            const response = await this.fetch(url);
            if (!response.ok) {
                throw new Error(`Alpha Vantage API error: ${response.statusText}`);
            }
            const data = await response.json();
            this.lastCall = Date.now();
            return data;
        } catch (error) {
            console.error('Alpha Vantage request failed:', error);
            throw error;
        }
    }

    async _checkRateLimit() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;
        const minDelay = (60 / this.rateLimit) * 1000;
        
        if (timeSinceLastCall < minDelay) {
            await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastCall));
        }
    }
}
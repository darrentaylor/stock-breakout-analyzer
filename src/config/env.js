import dotenv from 'dotenv';
dotenv.config();

export const config = {
    alphaVantage: {
        apiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
        baseUrl: 'https://www.alphavantage.co/query',
        rateLimit: 5
    }
};
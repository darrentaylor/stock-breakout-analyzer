import { MarketDataAPI } from './services/MarketDataAPI.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testApiKey() {
    console.log('\n═══════════════════════════════════════════');
    console.log('        ALPHA VANTAGE API KEY TEST         ');
    console.log('═══════════════════════════════════════════\n');

    // Debug: Show API key length (not the actual key)
    const apiKey = process.env.ALPHA_VANTAGE_KEY;
    console.log('API Key Check:', {
        exists: !!apiKey,
        length: apiKey?.length,
        prefix: apiKey?.substring(0, 3) + '...'
    });

    const api = new MarketDataAPI(apiKey);
    const isValid = await api.validateApiKey();
    
    console.log('\nTest Result:', isValid ? 'PASSED ✅' : 'FAILED ❌');
}

testApiKey().catch(console.error);
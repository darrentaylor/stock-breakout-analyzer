import { MarketDataAPI } from './services/MarketDataAPI.js';
import dotenv from 'dotenv';

dotenv.config();

async function testMarketData() {
    console.log('\n═══════════════════════════════════════════');
    console.log('        MARKET DATA REFRESH TEST           ');
    console.log('═══════════════════════════════════════════\n');

    const api = new MarketDataAPI(process.env.ALPHA_VANTAGE_KEY);
    
    try {
        // First request (should fetch from API)
        console.log('Test 1: Initial Data Fetch');
        const data1 = await api.getMarketData('AAPL');
        console.log(`Retrieved ${data1.length} days of data`);
        console.log(`Latest date: ${data1[data1.length - 1].date}\n`);

        // Second request (should use cache)
        console.log('Test 2: Cached Data Request');
        const data2 = await api.getMarketData('AAPL');
        console.log(`Retrieved ${data2.length} days of data`);
        console.log(`Latest date: ${data2[data2.length - 1].date}\n`);

        // Third request (force refresh)
        console.log('Test 3: Force Refresh Request');
        const data3 = await api.getMarketData('AAPL', true);
        console.log(`Retrieved ${data3.length} days of data`);
        console.log(`Latest date: ${data3[data3.length - 1].date}\n`);

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testMarketData().catch(console.error);
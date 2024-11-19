import { MarketDataAPI } from './services/MarketDataAPI.js';
import dotenv from 'dotenv';

dotenv.config();

async function testPremiumAPI() {
    console.log('\n═══════════════════════════════════════════');
    console.log('        PREMIUM API ACCESS TEST            ');
    console.log('═══════════════════════════════════════════\n');

    const api = new MarketDataAPI('C06SI2KXJN2N95Y9'); // Premium key
    
    try {
        // Test rapid requests
        console.log('Testing rapid API calls...\n');
        
        for (let i = 0; i < 3; i++) {
            console.log(`Request ${i + 1}:`);
            const data = await api.getMarketData('AAPL');
            console.log(`Success! Latest date: ${data[data.length - 1].date}\n`);
        }

        console.log('Premium API test completed successfully! ✅');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testPremiumAPI().catch(console.error);
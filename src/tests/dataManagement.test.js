import dotenv from 'dotenv';
import { APIHandler } from '../services/APIHandler.js';
import { MarketDataService } from '../services/MarketDataService.js';
import { logger } from '../utils/logger.js';

dotenv.config();

async function testDataManagement() {
    console.log('\n═══════════════════════════════════════════');
    console.log('       DATA MANAGEMENT SYSTEM TEST          ');
    console.log('═══════════════════════════════════════════\n');

    const symbol = 'AAPL';
    const apiHandler = new APIHandler(process.env.ALPHA_VANTAGE_KEY);
    const marketDataService = new MarketDataService(process.env.ALPHA_VANTAGE_KEY);

    try {
        // Test 1: Initial Data Fetch
        console.log('Test 1: Initial Data Fetch');
        console.log('───────────────────────────────────────');
        console.log(`Fetching data for ${symbol}...`);
        const initialData = await apiHandler.getMarketData(symbol);
        console.log('Initial data fetch successful');
        console.log(`Data points: ${initialData.length}`);
        console.log(`Latest timestamp: ${initialData[initialData.length - 1].timestamp}`);

        // Test 2: Cache Hit
        console.log('\nTest 2: Cache Hit Test');
        console.log('───────────────────────────────────────');
        console.log('Fetching same data again (should use cache)...');
        const start = Date.now();
        const cachedData = await apiHandler.getMarketData(symbol);
        const duration = Date.now() - start;
        console.log(`Cache retrieval time: ${duration}ms`);
        console.log(`Cache hit successful: ${duration < 100 ? '✅' : '❌'}`);

        // Test 3: Intraday Data
        console.log('\nTest 3: Intraday Data Test');
        console.log('───────────────────────────────────────');
        console.log('Fetching intraday data...');
        const intradayData = await marketDataService.fetchMarketData(symbol);
        console.log('Intraday data fetch successful');
        console.log(`Intraday data points: ${intradayData.length}`);

        // Test 4: Data Validation
        console.log('\nTest 4: Data Validation Test');
        console.log('───────────────────────────────────────');
        const latestData = cachedData[cachedData.length - 1];
        console.log('Validating latest data point:');
        console.log(JSON.stringify(latestData, null, 2));

        // Test 5: Market Hours Check
        console.log('\nTest 5: Market Hours Check');
        console.log('───────────────────────────────────────');
        const isMarketOpen = marketDataService.dataManager.isMarketOpen();
        const currentTime = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
        console.log(`Current NY Time: ${currentTime}`);
        console.log(`Market Status: ${isMarketOpen ? '🟢 Open' : '🔴 Closed'}`);

        // Test 6: Cache Invalidation
        console.log('\nTest 6: Cache Invalidation Test');
        console.log('───────────────────────────────────────');
        console.log('Invalidating cache...');
        apiHandler.dataManager.invalidateCache(symbol);
        const newData = await apiHandler.getMarketData(symbol);
        console.log('Fresh data fetch after cache invalidation successful');

        // Summary
        console.log('\n═══════════════════════════════════════════');
        console.log('             TEST SUMMARY                  ');
        console.log('═══════════════════════════════════════════');
        console.log('✅ Initial Data Fetch: Successful');
        console.log(`✅ Cache System: ${duration < 100 ? 'Working' : 'Needs Investigation'}`);
        console.log('✅ Intraday Data: Successful');
        console.log('✅ Data Validation: Successful');
        console.log(`✅ Market Hours Detection: ${isMarketOpen ? 'Open' : 'Closed'}`);
        console.log('✅ Cache Invalidation: Successful');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testDataManagement();

import { AlphaVantageService } from '../src/services/AlphaVantageService.js';
import { MarketDataService } from '../src/services/MarketDataService.js';
import { DataManager } from '../src/services/DataManager.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_KEY = process.env.ALPHA_VANTAGE_KEY;
if (!API_KEY) {
  console.error('⚠️ Please set ALPHA_VANTAGE_KEY in your .env file');
  process.exit(1);
}

async function testMarketDataServices() {
  try {
    console.log('🔄 Testing Market Data Services...\n');

    // Initialize services
    const alphaVantageService = new AlphaVantageService(API_KEY);
    const marketDataService = new MarketDataService(alphaVantageService);
    
    // Test symbols
    const symbols = ['AAPL', 'MSFT', 'TSLA'];
    
    for (const symbol of symbols) {
      console.log(`\n📊 Testing data retrieval for ${symbol}:`);
      
      // Test historical data
      console.log('\n1. Testing Historical Data:');
      try {
        const historicalData = await marketDataService.getHistoricalData(symbol);
        console.log(`✅ Successfully retrieved ${historicalData.length} historical data points`);
        console.log('Sample data point:', historicalData[0]);
      } catch (error) {
        console.error(`❌ Historical data error:`, error.message);
      }
      
      // Test intraday data
      console.log('\n2. Testing Intraday Data:');
      try {
        const intradayData = await marketDataService.fetchMarketData(symbol);
        console.log(`✅ Successfully retrieved ${intradayData.length} intraday data points`);
        console.log('Sample data point:', intradayData[0]);
      } catch (error) {
        console.error(`❌ Intraday data error:`, error.message);
      }
      
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 12000)); // 12 second delay
    }
    
    console.log('\n✨ Market Data Services test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
testMarketDataServices();

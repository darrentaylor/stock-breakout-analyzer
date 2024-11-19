import axios from 'axios';

export class MarketDataAPI {
  constructor(premiumKey, basicKey) {
    this.premiumKey = premiumKey;
    this.basicKey = basicKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
  }

  async getMarketData(symbol, isPremium = false) {
    try {
      console.log('DEBUG: Making API request with ' + (isPremium ? 'premium' : 'basic') + ' key...');
      
      const apiKey = isPremium ? this.premiumKey : this.basicKey;
      const response = await fetch(
        `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apiKey}`
      );
      
      const data = await response.json();
      
      console.log('\nDEBUG: API Metadata:', data['Meta Data']);
      console.log('DEBUG: Latest Refresh:', data['Meta Data']['3. Last Refreshed']);
      console.log('\nDEBUG: Raw API Response Structure:', Object.keys(data));
      
      const timeSeriesData = data['Time Series (Daily)'];
      if (!timeSeriesData) {
        throw new Error('No time series data available');
      }
      
      // Sort dates in descending order and get last 100 days
      const sortedDates = Object.keys(timeSeriesData)
        .sort((a, b) => new Date(b) - new Date(a))
        .slice(0, 100);
      
      const processedData = sortedDates.map(date => {
        const entry = timeSeriesData[date];
        return {
          date,
          open: parseFloat(entry['1. open']),
          high: parseFloat(entry['2. high']),
          low: parseFloat(entry['3. low']),
          close: parseFloat(entry['4. close']),
          volume: parseInt(entry['5. volume']),
          adjClose: parseFloat(entry['4. close']) // Using close as adjusted close
        };
      });
      
      console.log('\nDEBUG: Processed Data First Entry:', processedData[0]);
      console.log('DEBUG: Processed Data Length:', processedData.length);
      
      return processedData;
      
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }
}
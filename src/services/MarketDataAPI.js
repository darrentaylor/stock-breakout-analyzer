import axios from 'axios';

export class MarketDataAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
  }

  processMarketData(rawData) {
    console.log('\nDEBUG: Raw API Response Structure:', Object.keys(rawData));
    
    const timeSeriesData = rawData['Time Series (Daily)'];
    if (!timeSeriesData) {
      console.error('DEBUG: Raw API Response:', rawData);
      throw new Error('Invalid API response format');
    }

    const currentDate = new Date();
    
    // Convert to array and sort by date (newest first)
    const processedData = Object.entries(timeSeriesData)
      .map(([date, data]) => ({
        date,
        open: parseFloat(data['1. open']),
        high: parseFloat(data['2. high']),
        low: parseFloat(data['3. low']),
        close: parseFloat(data['4. close']),
        volume: parseInt(data['5. volume']),
        adjClose: parseFloat(data['4. close'])
      }))
      // Filter out future dates and invalid data
      .filter(data => {
        const dataDate = new Date(data.date);
        return dataDate <= currentDate && 
               !isNaN(data.open) && 
               !isNaN(data.close) && 
               data.volume > 0;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (processedData.length === 0) {
      throw new Error('No valid market data available after filtering');
    }

    console.log('\nDEBUG: Processed Data First Entry:', processedData[0]);
    console.log('DEBUG: Processed Data Length:', processedData.length);
    
    return processedData;
  }

  async getMarketData(symbol, forceRefresh = false) {
    try {
      console.log('DEBUG: Making API request with premium key...');
      // Using outputsize=full to get all available data
      const response = await fetch(
        `${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      // Debug the metadata
      console.log('\nDEBUG: API Metadata:', data['Meta Data']);
      console.log('DEBUG: Latest Refresh:', data['Meta Data']?.['3. Last Refreshed']);

      return this.processMarketData(data);

    } catch (error) {
      console.error('MarketDataAPI error:', error.message);
      throw error;
    }
  }
}
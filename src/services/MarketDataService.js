async fetchMarketData(symbol) {
    try {
      // Use Alpha Vantage real-time endpoint
      const response = await axios.get(
        `${this.baseUrl}/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${this.apiKey}`
      );
  
      // Verify data is current
      const latestTimestamp = Object.keys(response.data['Time Series (5min)'])[0];
      const currentTime = new Date();
      const dataTime = new Date(latestTimestamp);
      
      if (currentTime - dataTime > 24 * 60 * 60 * 1000) {
        console.warn('Warning: Data may not be current');
      }
  
      return this.formatMarketData(response.data);
    } catch (error) {
      console.error('Error fetching market data:', error);
      throw error;
    }
  }

  async validateData(data) {
    const now = new Date();
    const marketData = data['Time Series (Daily)'];
    const latestDate = Object.keys(marketData)[0];
    const dataAge = now - new Date(latestDate);
    
    // Check if data is stale (more than 24 hours old on trading days)
    if (dataAge > 24 * 60 * 60 * 1000 && this.isTradingDay(now)) {
      console.warn(`⚠️ Warning: Data may be stale. Latest data from: ${latestDate}`);
    }

    // Verify price ranges
    const latestPrice = parseFloat(marketData[latestDate]['4. close']);
    if (this.isUnrealisticPrice(latestPrice)) {
      console.error(`🚨 Error: Unrealistic price detected: ${latestPrice}`);
      throw new Error('Invalid price data');
    }

    return {
      isValid: true,
      timestamp: latestDate,
      age: dataAge,
      price: latestPrice
    };
  }

  isTradingDay(date) {
    const day = date.getDay();
    return day !== 0 && day !== 6; // Not weekend
  }

  isUnrealisticPrice(price) {
    // Add reasonable price range checks
    return price <= 0 || price > 1000000;
  }
}
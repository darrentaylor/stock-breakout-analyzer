import { expect, test, describe, beforeEach, vi } from 'vitest';
import { APIHandler } from '../src/services/APIHandler.js';
import axios from 'axios';

vi.mock('axios');

describe('APIHandler', () => {
  let apiHandler;
  const mockValidData = {
    'Time Series (Daily)': {
      '2023-11-14': {
        '1. open': '100.0000',
        '2. high': '101.0000',
        '3. low': '99.0000',
        '4. close': '100.5000',
        '5. volume': '1000000'
      },
      '2023-11-13': {
        '1. open': '99.0000',
        '2. high': '100.0000',
        '3. low': '98.0000',
        '4. close': '99.5000',
        '5. volume': '900000'
      }
    }
  };

  beforeEach(() => {
    apiHandler = new APIHandler('test-av-key');
    vi.clearAllMocks();
  });

  test('should handle successful API response', async () => {
    axios.get.mockResolvedValueOnce({ data: mockValidData });

    const result = await apiHandler.getMarketData('AAPL');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      open: 99,
      high: 100,
      low: 98,
      close: 99.5,
      volume: 900000,
      interval: 'daily'
    });
  });

  test('should handle API error message', async () => {
    axios.get.mockResolvedValueOnce({
      data: { 'Error Message': 'Invalid API call' }
    });

    await expect(apiHandler.getMarketData('INVALID'))
      .rejects
      .toThrow('Alpha Vantage API error: Invalid API call');
  });

  test('should handle API rate limit', async () => {
    axios.get.mockResolvedValueOnce({
      data: { 'Note': 'API limit reached' }
    });

    await expect(apiHandler.getMarketData('AAPL'))
      .rejects
      .toThrow('API limit reached');
  });

  test('should handle network timeout', async () => {
    axios.get.mockRejectedValueOnce({
      code: 'ECONNABORTED',
      isAxiosError: true
    });

    await expect(apiHandler.getMarketData('AAPL'))
      .rejects
      .toThrow('API request timed out');
  });

  test('should validate data structure', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        'Time Series (Daily)': {
          '2023-11-14': {
            '1. open': 'invalid',
            '2. high': '101.0000',
            '3. low': '99.0000',
            '4. close': '100.5000',
            '5. volume': '1000000'
          }
        }
      }
    });
    
    await expect(apiHandler.getMarketData('AAPL'))
      .rejects
      .toThrow('Data validation failed');
  });

  test('should use cached data when available', async () => {
    axios.get.mockResolvedValueOnce({ data: mockValidData });
    
    // First call should hit the API
    await apiHandler.getMarketData('AAPL');
    
    // Second call should use cache
    await apiHandler.getMarketData('AAPL');
    
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
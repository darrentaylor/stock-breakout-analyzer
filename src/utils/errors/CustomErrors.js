export class MarketAnalysisError extends Error {
  constructor(message, code = 'MARKET_ANALYSIS_ERROR', metadata = {}) {
    super(message);
    this.name = 'MarketAnalysisError';
    this.code = code;
    this.metadata = metadata;
  }
}

export class APIError extends Error {
  constructor(message, code = 'API_ERROR', metadata = {}) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.metadata = metadata;
  }
}

export class ValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR', metadata = {}) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.metadata = metadata;
  }
}

export class TechnicalAnalysisError extends Error {
  constructor(message, code = 'TECHNICAL_ANALYSIS_ERROR', metadata = {}) {
    super(message);
    this.name = 'TechnicalAnalysisError';
    this.code = code;
    this.metadata = metadata;
  }
}
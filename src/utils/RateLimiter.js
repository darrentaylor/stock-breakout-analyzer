export class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
  }

  async waitForToken() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    if (timePassed >= this.timeWindow) {
      this.tokens = this.maxRequests;
      this.lastRefill = now;
    }

    if (this.tokens <= 0) {
      const waitTime = this.timeWindow - timePassed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForToken();
    }

    this.tokens--;
    return true;
  }
}
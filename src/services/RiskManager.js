export class RiskManager {
  calculatePositionSize(capital, risk, entry, stop) {
    const riskAmount = capital * (risk / 100);
    const stopDistance = Math.abs(entry - stop);
    return Math.floor(riskAmount / stopDistance);
  }

  generateTradePlan(analysis) {
    const { signals } = analysis;
    if (!signals) return null;

    const entry = signals.entry_points.conservative;
    const stop = signals.stops.initial;
    const target = signals.targets[1]; // Using second target for R:R

    const riskReward = (target - entry) / (entry - stop);
    const positionSize = this.calculatePositionSize(100000, 1, entry, stop);

    return {
      position_size: positionSize,
      risk_reward: riskReward,
      max_risk: (entry - stop) * positionSize,
      entry_price: entry,
      stop_loss: stop,
      targets: signals.targets
    };
  }
}
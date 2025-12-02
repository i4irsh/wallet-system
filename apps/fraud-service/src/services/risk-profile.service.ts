import { Injectable, Logger } from '@nestjs/common';
import { FraudRepository } from '../repositories/fraud.repository';
import { AlertSeverity, RiskLevel } from '../entities';

@Injectable()
export class RiskProfileService {
  private readonly logger = new Logger(RiskProfileService.name);

  // Severity to score mapping
  private readonly SEVERITY_SCORES: Record<AlertSeverity, number> = {
    [AlertSeverity.LOW]: 5,
    [AlertSeverity.MEDIUM]: 15,
    [AlertSeverity.HIGH]: 30,
    [AlertSeverity.CRITICAL]: 50,
  };

  // Risk level thresholds
  private readonly RISK_THRESHOLDS = {
    LOW: 25,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 100,
  };

  constructor(private readonly fraudRepository: FraudRepository) {}

  async updateRiskProfile(
    walletId: string,
    alertSeverity: AlertSeverity,
  ): Promise<void> {
    try {
      // Get or create risk profile
      let profile = await this.fraudRepository.getRiskProfile(walletId);

      if (!profile) {
        profile = await this.fraudRepository.createRiskProfile(walletId);
        this.logger.log(`Created new risk profile for wallet ${walletId}`);
      }

      // Calculate new score
      const scoreIncrease = this.SEVERITY_SCORES[alertSeverity];
      const newScore = Math.min(profile.riskScore + scoreIncrease, 100);
      const newLevel = this.calculateRiskLevel(newScore);
      const newAlertCount = profile.alertCount + 1;

      // Update profile
      await this.fraudRepository.updateRiskProfile(walletId, {
        riskScore: newScore,
        riskLevel: newLevel,
        alertCount: newAlertCount,
      });

      this.logger.log(
        `Updated risk profile for wallet ${walletId}: score ${profile.riskScore} -> ${newScore}, level ${profile.riskLevel} -> ${newLevel}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating risk profile for wallet ${walletId}`,
        error,
      );
      throw error;
    }
  }

  private calculateRiskLevel(score: number): RiskLevel {
    if (score <= this.RISK_THRESHOLDS.LOW) {
      return RiskLevel.LOW;
    } else if (score <= this.RISK_THRESHOLDS.MEDIUM) {
      return RiskLevel.MEDIUM;
    } else if (score <= this.RISK_THRESHOLDS.HIGH) {
      return RiskLevel.HIGH;
    } else {
      return RiskLevel.CRITICAL;
    }
  }
}

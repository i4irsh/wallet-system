import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import {
  AlertEntity,
  AlertSeverity,
  RiskProfileEntity,
  RiskLevel,
  RecentEventEntity,
} from '../entities';

interface CreateAlertDto {
  walletId: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  transactionId: string | null;
  eventType: string;
  eventData: Record<string, any>;
}

interface UpdateRiskProfileDto {
  riskScore: number;
  riskLevel: RiskLevel;
  alertCount: number;
}

interface TrackEventDto {
  walletId: string;
  eventType: string;
  amount?: number;
  transactionId?: string;
}

@Injectable()
export class FraudRepository {
  private readonly logger = new Logger(FraudRepository.name);

  constructor(
    @InjectRepository(AlertEntity)
    private readonly alertRepository: Repository<AlertEntity>,
    @InjectRepository(RiskProfileEntity)
    private readonly riskProfileRepository: Repository<RiskProfileEntity>,
    @InjectRepository(RecentEventEntity)
    private readonly recentEventRepository: Repository<RecentEventEntity>,
  ) {}

  // Alert methods
  async createAlert(dto: CreateAlertDto): Promise<AlertEntity> {
    const alert = this.alertRepository.create({
      walletId: dto.walletId,
      ruleId: dto.ruleId,
      ruleName: dto.ruleName,
      severity: dto.severity,
      transactionId: dto.transactionId,
      eventType: dto.eventType,
      eventData: dto.eventData,
    });

    const savedAlert = await this.alertRepository.save(alert);
    this.logger.debug(
      `Created alert ${savedAlert.id} for wallet ${dto.walletId}`,
    );
    return savedAlert;
  }

  async getAlertsByWalletId(walletId: string): Promise<AlertEntity[]> {
    return this.alertRepository.find({
      where: { walletId },
      order: { createdAt: 'DESC' },
    });
  }

  // Risk profile methods
  async getRiskProfile(walletId: string): Promise<RiskProfileEntity | null> {
    return this.riskProfileRepository.findOne({
      where: { walletId },
    });
  }

  async createRiskProfile(walletId: string): Promise<RiskProfileEntity> {
    const profile = this.riskProfileRepository.create({
      walletId,
      riskScore: 0,
      riskLevel: RiskLevel.LOW,
      alertCount: 0,
    });

    return this.riskProfileRepository.save(profile);
  }

  async updateRiskProfile(
    walletId: string,
    dto: UpdateRiskProfileDto,
  ): Promise<void> {
    await this.riskProfileRepository.update(
      { walletId },
      {
        riskScore: dto.riskScore,
        riskLevel: dto.riskLevel,
        alertCount: dto.alertCount,
        lastUpdated: new Date(),
      },
    );
  }

  // Recent event tracking methods
  async trackEvent(dto: TrackEventDto): Promise<void> {
    const event = this.recentEventRepository.create({
      walletId: dto.walletId,
      eventType: dto.eventType,
      amount: dto.amount,
      transactionId: dto.transactionId,
    });

    await this.recentEventRepository.save(event);
    this.logger.debug(
      `Tracked event ${dto.eventType} for wallet ${dto.walletId}`,
    );
  }

  // Methods for fraud rule evaluation
  async getRecentTransactionCount(
    walletId: string,
    windowMinutes: number,
  ): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const count = await this.recentEventRepository.count({
      where: {
        walletId,
        createdAt: MoreThan(since),
      },
    });

    return count;
  }

  async hasRecentDeposit(
    walletId: string,
    windowMinutes: number,
  ): Promise<boolean> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const depositEvent = await this.recentEventRepository.findOne({
      where: {
        walletId,
        eventType: 'MoneyDepositedEvent',
        createdAt: MoreThan(since),
      },
    });

    return depositEvent !== null;
  }

  async getRecentAlerts(
    walletId: string,
    windowMinutes: number,
  ): Promise<AlertEntity[]> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    return this.alertRepository.find({
      where: {
        walletId,
        createdAt: MoreThan(since),
      },
      order: { createdAt: 'DESC' },
    });
  }
}

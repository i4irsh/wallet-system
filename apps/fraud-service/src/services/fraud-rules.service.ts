import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Engine, Rule } from 'json-rules-engine';
import { FraudRepository } from '../repositories/fraud.repository';

export interface FraudEvaluationContext {
  walletId: string;
  eventType: string;
  amount: number;
  transactionId?: string;
  timestamp: Date;
  eventData: Record<string, any>;
}

export interface FraudAlert {
  ruleId: string;
  ruleName: string;
  severity: string;
}

@Injectable()
export class FraudRulesService implements OnModuleInit {
  private readonly logger = new Logger(FraudRulesService.name);
  private engine: Engine;

  // Configurable thresholds
  private readonly LARGE_TRANSACTION_THRESHOLD = 10000;
  private readonly VELOCITY_TRANSACTION_COUNT = 5;
  private readonly VELOCITY_TIME_WINDOW_MINUTES = 10;
  private readonly RAPID_WITHDRAWAL_WINDOW_MINUTES = 5;

  constructor(private readonly fraudRepository: FraudRepository) {}

  async onModuleInit(): Promise<void> {
    this.initializeEngine();
  }

  private initializeEngine(): void {
    this.engine = new Engine();

    // Rule 1: Large Transaction Alert
    this.engine.addRule(this.createLargeTransactionRule());

    // Rule 2: Velocity Check (handled via custom fact)
    this.engine.addRule(this.createVelocityRule());

    // Rule 3: Rapid Withdrawal Pattern (handled via custom fact)
    this.engine.addRule(this.createRapidWithdrawalRule());

    this.logger.log('Fraud rules engine initialized with 3 rules');
  }

  private createLargeTransactionRule(): Rule {
    return new Rule({
      name: 'Large Transaction Alert',
      conditions: {
        all: [
          {
            fact: 'amount',
            operator: 'greaterThan',
            value: this.LARGE_TRANSACTION_THRESHOLD,
          },
        ],
      },
      event: {
        type: 'fraud-alert',
        params: {
          ruleId: 'large-transaction',
          ruleName: 'Large Transaction Alert',
          severity: 'HIGH',
          message: `Transaction exceeds $${this.LARGE_TRANSACTION_THRESHOLD}`,
        },
      },
    });
  }

  private createVelocityRule(): Rule {
    return new Rule({
      name: 'High Velocity Alert',
      conditions: {
        all: [
          {
            fact: 'recentTransactionCount',
            operator: 'greaterThan',
            value: this.VELOCITY_TRANSACTION_COUNT,
          },
        ],
      },
      event: {
        type: 'fraud-alert',
        params: {
          ruleId: 'high-velocity',
          ruleName: 'High Velocity Alert',
          severity: 'MEDIUM',
          message: `More than ${this.VELOCITY_TRANSACTION_COUNT} transactions in ${this.VELOCITY_TIME_WINDOW_MINUTES} minutes`,
        },
      },
    });
  }

  private createRapidWithdrawalRule(): Rule {
    return new Rule({
      name: 'Rapid Withdrawal Pattern',
      conditions: {
        all: [
          {
            fact: 'isWithdrawal',
            operator: 'equal',
            value: true,
          },
          {
            fact: 'hasRecentDeposit',
            operator: 'equal',
            value: true,
          },
        ],
      },
      event: {
        type: 'fraud-alert',
        params: {
          ruleId: 'rapid-withdrawal',
          ruleName: 'Rapid Withdrawal Pattern',
          severity: 'HIGH',
          message: `Withdrawal detected within ${this.RAPID_WITHDRAWAL_WINDOW_MINUTES} minutes of deposit`,
        },
      },
    });
  }

  async evaluateRules(context: FraudEvaluationContext): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    try {
      // Calculate dynamic facts
      const recentTransactionCount = await this.fraudRepository.getRecentTransactionCount(
        context.walletId,
        this.VELOCITY_TIME_WINDOW_MINUTES,
      );

      const hasRecentDeposit = await this.fraudRepository.hasRecentDeposit(
        context.walletId,
        this.RAPID_WITHDRAWAL_WINDOW_MINUTES,
      );

      const isWithdrawal = context.eventType === 'MoneyWithdrawnEvent';

      // Set up facts for the rules engine
      const facts = {
        walletId: context.walletId,
        eventType: context.eventType,
        amount: context.amount,
        transactionId: context.transactionId,
        timestamp: context.timestamp,
        recentTransactionCount,
        hasRecentDeposit,
        isWithdrawal,
      };

      this.logger.debug('Evaluating rules with facts:', facts);

      // Run the rules engine
      const results = await this.engine.run(facts);

      // Process triggered events
      for (const event of results.events) {
        if (event.type === 'fraud-alert') {
          const params = event.params as {
            ruleId: string;
            ruleName: string;
            severity: string;
            message: string;
          };
          alerts.push({
            ruleId: params.ruleId,
            ruleName: params.ruleName,
            severity: params.severity,
          });

          this.logger.warn(`Rule triggered: ${params.ruleName} - ${params.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Error evaluating fraud rules', error);
      throw error;
    }

    return alerts;
  }
}

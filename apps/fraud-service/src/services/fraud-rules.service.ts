import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Engine, Rule } from 'json-rules-engine';
import { FRAUD_RULES, ALERT_SEVERITIES, FRAUD_ALERT_EVENT_TYPE, EVENT_TYPES } from '@app/shared';
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
      name: FRAUD_RULES.LARGE_TRANSACTION.NAME,
      conditions: {
        all: [
          {
            fact: 'amount',
            operator: 'greaterThan',
            value: FRAUD_RULES.LARGE_TRANSACTION.THRESHOLD,
          },
        ],
      },
      event: {
        type: FRAUD_ALERT_EVENT_TYPE,
        params: {
          ruleId: FRAUD_RULES.LARGE_TRANSACTION.ID,
          ruleName: FRAUD_RULES.LARGE_TRANSACTION.NAME,
          severity: ALERT_SEVERITIES.HIGH,
          message: `Transaction exceeds $${FRAUD_RULES.LARGE_TRANSACTION.THRESHOLD}`,
        },
      },
    });
  }

  private createVelocityRule(): Rule {
    return new Rule({
      name: FRAUD_RULES.HIGH_VELOCITY.NAME,
      conditions: {
        all: [
          {
            fact: 'recentTransactionCount',
            operator: 'greaterThan',
            value: FRAUD_RULES.HIGH_VELOCITY.TRANSACTION_COUNT,
          },
        ],
      },
      event: {
        type: FRAUD_ALERT_EVENT_TYPE,
        params: {
          ruleId: FRAUD_RULES.HIGH_VELOCITY.ID,
          ruleName: FRAUD_RULES.HIGH_VELOCITY.NAME,
          severity: ALERT_SEVERITIES.MEDIUM,
          message: `More than ${FRAUD_RULES.HIGH_VELOCITY.TRANSACTION_COUNT} transactions in ${FRAUD_RULES.HIGH_VELOCITY.TIME_WINDOW_MINUTES} minutes`,
        },
      },
    });
  }

  private createRapidWithdrawalRule(): Rule {
    return new Rule({
      name: FRAUD_RULES.RAPID_WITHDRAWAL.NAME,
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
        type: FRAUD_ALERT_EVENT_TYPE,
        params: {
          ruleId: FRAUD_RULES.RAPID_WITHDRAWAL.ID,
          ruleName: FRAUD_RULES.RAPID_WITHDRAWAL.NAME,
          severity: ALERT_SEVERITIES.HIGH,
          message: `Withdrawal detected within ${FRAUD_RULES.RAPID_WITHDRAWAL.TIME_WINDOW_MINUTES} minutes of deposit`,
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
        FRAUD_RULES.HIGH_VELOCITY.TIME_WINDOW_MINUTES,
      );

      const hasRecentDeposit = await this.fraudRepository.hasRecentDeposit(
        context.walletId,
        FRAUD_RULES.RAPID_WITHDRAWAL.TIME_WINDOW_MINUTES,
        EVENT_TYPES.MONEY_DEPOSITED,
      );

      const isWithdrawal = context.eventType === EVENT_TYPES.MONEY_WITHDRAWN;

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
        if (event.type === FRAUD_ALERT_EVENT_TYPE) {
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

import { Injectable } from '@nestjs/common';
import { EventPublisher } from '@nestjs/cqrs';
import { 
  EventStoreService, 
  MoneyDepositedEvent, 
  MoneyWithdrawnEvent, 
  MoneyTransferredEvent 
} from '@app/shared';
import { WalletAggregate } from '../aggregates/wallet.aggregate';

@Injectable()
export class WalletRepository {
  constructor(
    private readonly eventStore: EventStoreService,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async findById(walletId: string): Promise<WalletAggregate> {
    const wallet = new WalletAggregate(walletId);
    
    // Load events from event store
    const events = await this.eventStore.getEvents(walletId);
    
    // Replay events to rebuild state
    for (const storedEvent of events) {
      const event = this.deserializeEvent(storedEvent.eventType, storedEvent.eventData);
      if (event) {
        wallet.replayEvent(event);
      }
    }

    // Set the current version
    wallet.setVersion(events.length);

    // Merge with event publisher context
    return this.eventPublisher.mergeObjectContext(wallet);
  }

  async save(wallet: WalletAggregate): Promise<void> {
    const uncommittedEvents = wallet.getUncommittedEvents();
    
    if (uncommittedEvents.length === 0) {
      return;
    }

    // Save events to event store
    await this.eventStore.saveEvents(
      wallet.getId(),
      'WalletAggregate',
      uncommittedEvents,
      wallet.getVersion() - uncommittedEvents.length,
    );

    // Commit events (publishes to event bus)
    wallet.commit();
  }

  private deserializeEvent(eventType: string, eventData: Record<string, any>): any {
    switch (eventType) {
      case 'MoneyDepositedEvent':
        return new MoneyDepositedEvent(
          eventData.walletId,
          eventData.amount,
          new Date(eventData.timestamp),
          eventData.transactionId,
        );
      case 'MoneyWithdrawnEvent':
        return new MoneyWithdrawnEvent(
          eventData.walletId,
          eventData.amount,
          new Date(eventData.timestamp),
          eventData.transactionId,
        );
      case 'MoneyTransferredEvent':
        return new MoneyTransferredEvent(
          eventData.fromWalletId,
          eventData.toWalletId,
          eventData.amount,
          new Date(eventData.timestamp),
          eventData.transactionId,
        );
      default:
        console.warn(`Unknown event type: ${eventType}`);
        return null;
    }
  }
}
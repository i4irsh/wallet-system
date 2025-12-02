import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventStoreEntity } from './event-store.entity';

export interface StoredEvent {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: Record<string, any>;
  version: number;
  transactionId?: string;
}

@Injectable()
export class EventStoreService {
  constructor(
    @InjectRepository(EventStoreEntity)
    private readonly eventStoreRepository: Repository<EventStoreEntity>,
  ) {}

  async saveEvents(
    aggregateId: string,
    aggregateType: string,
    events: any[],
    expectedVersion: number,
  ): Promise<void> {
    let version = expectedVersion;

    const eventEntities = events.map((event) => {
      version++;
      return this.eventStoreRepository.create({
        aggregateId,
        aggregateType,
        eventType: event.constructor.name,
        eventData: this.serializeEvent(event),
        version,
        transactionId: event.transactionId,
      });
    });

    await this.eventStoreRepository.save(eventEntities);
  }

  async getEvents(aggregateId: string): Promise<EventStoreEntity[]> {
    return this.eventStoreRepository.find({
      where: { aggregateId },
      order: { version: 'ASC' },
    });
  }

  async getLatestVersion(aggregateId: string): Promise<number> {
    const result = await this.eventStoreRepository.findOne({
      where: { aggregateId },
      order: { version: 'DESC' },
    });

    return result ? result.version : 0;
  }

  async getAllEvents(): Promise<EventStoreEntity[]> {
    return this.eventStoreRepository.find({
      order: { timestamp: 'ASC' },
    });
  }

  private serializeEvent(event: any): Record<string, any> {
    const serialized: Record<string, any> = {};

    for (const key of Object.keys(event)) {
      const value = event[key];
      if (value instanceof Date) {
        serialized[key] = value.toISOString();
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventStoreEntity } from './event-store.entity';
import { EventStoreService } from './event-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventStoreEntity])],
  providers: [EventStoreService],
  exports: [EventStoreService, TypeOrmModule],
})
export class EventStoreModule {}
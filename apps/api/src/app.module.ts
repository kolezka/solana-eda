import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsModule } from './modules/events/events.module';
import { WorkersModule } from './modules/workers/workers.module';
import { TradingModule } from './modules/trading/trading.module';
import { PositionsModule } from './modules/positions/positions.module';
import { QueuesModule } from './modules/queues/queues.module';
import { RedisModule } from './redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';
import { BullMQModule } from './bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    RedisModule,
    BullMQModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ':',
    }),
    EventsModule,
    WorkersModule,
    TradingModule,
    PositionsModule,
    QueuesModule,
  ],
  providers: [],
})
export class AppModule {}

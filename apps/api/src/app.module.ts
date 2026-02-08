import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsModule } from './modules/events/events.module';
import { WorkersModule } from './modules/workers/workers.module';
import { TradingModule } from './modules/trading/trading.module';
import { PositionsModule } from './modules/positions/positions.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    DatabaseModule,
    RedisModule,
    EventsModule,
    WorkersModule,
    TradingModule,
    PositionsModule,
  ],
})
export class AppModule {}

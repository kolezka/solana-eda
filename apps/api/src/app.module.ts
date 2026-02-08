import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsModule } from './modules/events/events.module';
import { WorkersModule } from './modules/workers/workers.module';
import { TradingModule } from './modules/trading/trading.module';
import { PositionsModule } from './modules/positions/positions.module';
import { RedisModule } from './redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    RedisModule,
    EventsModule,
    WorkersModule,
    TradingModule,
    PositionsModule,
  ],
  providers: [],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsSseController } from './events-sse.controller';
import { EventsService } from './events.service';
import { EventsGateway } from './events.gateway';
import { RabbitMQModule } from '../../rabbitmq/rabbitmq.module';
import {
  BurnEventConsumer,
  LiquidityEventConsumer,
  TradeEventConsumer,
  PositionEventConsumer,
  PriceEventConsumer,
  WorkerStatusConsumer,
} from '../../consumers';

@Module({
  imports: [RabbitMQModule],
  controllers: [EventsController, EventsSseController],
  providers: [
    EventsService,
    EventsGateway,
    BurnEventConsumer,
    LiquidityEventConsumer,
    TradeEventConsumer,
    PositionEventConsumer,
    PriceEventConsumer,
    WorkerStatusConsumer,
  ],
  exports: [EventsService],
})
export class EventsModule {}

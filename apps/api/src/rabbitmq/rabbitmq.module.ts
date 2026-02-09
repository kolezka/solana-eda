import { Module, Global, DynamicModule, Provider, InjectionToken, Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { RabbitMQConnection, RabbitMQProducer, RabbitMQConsumer, setupTopology, setupDLQ } from '@solana-eda/rabbitmq';

/**
 * RabbitMQ connection options interface
 */
export interface RabbitMQOptions {
  urls: string[];
  queue: string;
  prefetchCount: number;
  isGlobal: boolean;
  enableControllerDiscovery: boolean;
}

/**
 * RabbitMQ Module Configuration Token
 */
export const RABBITMQ_OPTIONS = 'RABBITMQ_OPTIONS';

/**
 * RabbitMQ Connection Token
 */
export const RABBITMQ_CONNECTION = 'RABBITMQ_CONNECTION';

/**
 * RabbitMQ Producer Token
 */
export const RABBITMQ_PRODUCER = 'RABBITMQ_PRODUCER';

/**
 * RabbitMQ Consumer Token
 */
export const RABBITMQ_CONSUMER = 'RABBITMQ_CONSUMER';

/**
 * RabbitMQ Async Options Interface
 */
export interface RabbitMQModuleAsyncOptions {
  isGlobal?: boolean;
  imports?: Array<any>;
  useFactory?: (...args: any[]) => Promise<RabbitMQOptions> | RabbitMQOptions;
  inject?: Array<InjectionToken>;
}

/**
 * RabbitMQ Provider for Connection
 */
@Injectable()
export class RabbitMQConnectionProvider implements OnModuleInit, OnModuleDestroy {
  private connection: RabbitMQConnection | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('RABBITMQ_URL') || 'amqp://solana:solana123@localhost:5672';

    this.connection = new RabbitMQConnection({
      url,
      exchangeName: 'solana.events',
      enablePublisherConfirms: true,
      prefetchCount: this.configService.get<number>('RABBITMQ_PREFETCH_COUNT', 10),
      reconnectDelay: 5000,
      maxRetries: 10,
    });

    await this.connection.connect();
  }

  getConnection(): RabbitMQConnection {
    if (!this.connection) {
      throw new Error('RabbitMQ connection not initialized');
    }
    return this.connection;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }
}

/**
 * RabbitMQ Producer Provider
 */
@Injectable()
export class RabbitMQProducerProvider implements OnModuleInit {
  private producer: RabbitMQProducer | null = null;

  constructor(@Inject(RABBITMQ_CONNECTION) private connectionProvider: RabbitMQConnectionProvider) {}

  async onModuleInit(): Promise<void> {
    const connection = this.connectionProvider.getConnection();
    this.producer = new RabbitMQProducer(connection, 'solana.events', 'api');
  }

  getProducer(): RabbitMQProducer {
    if (!this.producer) {
      throw new Error('RabbitMQ producer not initialized');
    }
    return this.producer;
  }
}

/**
 * RabbitMQ Consumer Provider
 */
@Injectable()
export class RabbitMQConsumerProvider implements OnModuleInit {
  private consumer: RabbitMQConsumer | null = null;

  constructor(@Inject(RABBITMQ_CONNECTION) private connectionProvider: RabbitMQConnectionProvider) {}

  async onModuleInit(): Promise<void> {
    const connection = this.connectionProvider.getConnection();
    this.consumer = new RabbitMQConsumer(connection, 10);
  }

  getConsumer(): RabbitMQConsumer {
    if (!this.consumer) {
      throw new Error('RabbitMQ consumer not initialized');
    }
    return this.consumer;
  }
}

/**
 * RabbitMQ Module
 */
@Global()
@Module({
  providers: [
    RabbitMQConnectionProvider,
    RabbitMQProducerProvider,
    RabbitMQConsumerProvider,
    {
      provide: RABBITMQ_CONNECTION,
      useExisting: RabbitMQConnectionProvider,
    },
    {
      provide: RABBITMQ_PRODUCER,
      useExisting: RabbitMQProducerProvider,
    },
    {
      provide: RABBITMQ_CONSUMER,
      useExisting: RabbitMQConsumerProvider,
    },
  ],
  exports: [
    RABBITMQ_CONNECTION,
    RABBITMQ_PRODUCER,
    RABBITMQ_CONSUMER,
    RabbitMQConnectionProvider,
    RabbitMQProducerProvider,
    RabbitMQConsumerProvider,
  ],
})
export class RabbitMQModule {
  static forRoot(options: RabbitMQOptions): DynamicModule {
    return {
      module: RabbitMQModule,
      providers: [
        {
          provide: RABBITMQ_OPTIONS,
          useValue: options,
        },
      ],
      exports: [
        RABBITMQ_OPTIONS,
      ],
    };
  }

  static forRootAsync(options: RabbitMQModuleAsyncOptions): DynamicModule {
    const asyncProviders: Provider[] = [
      {
        provide: RABBITMQ_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
    ];

    return {
      module: RabbitMQModule,
      imports: options.imports || [],
      providers: asyncProviders,
      exports: [
        RABBITMQ_OPTIONS,
      ],
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: RabbitMQModule,
    };
  }
}

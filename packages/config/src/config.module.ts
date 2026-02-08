import { Module, Global } from '@nestjs/common';
import { ConfigService, getConfigService } from './config.service';

/**
 * Configuration values provider token
 */
export const CONFIG_VALUES = 'CONFIG_VALUES';

/**
 * Global configuration module
 */
@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useFactory: () => getConfigService(),
    },
    {
      provide: CONFIG_VALUES,
      useFactory: (configService: ConfigService) => configService.getConfig(),
      inject: [ConfigService],
    },
  ],
  exports: [ConfigService, CONFIG_VALUES],
})
export class ConfigModule {}

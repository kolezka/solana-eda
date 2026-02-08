import { Module, Global } from '@nestjs/common';
import { getPrismaClient } from '@solana-eda/database';

@Global()
@Module({
  providers: [
    {
      provide: 'PRISMA',
      useFactory: () => getPrismaClient(),
    },
  ],
  exports: ['PRISMA'],
})
export class DatabaseModule {}

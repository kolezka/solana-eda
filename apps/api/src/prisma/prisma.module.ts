import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: 'PRISMA',
      useClass: PrismaService,
    },
  ],
  exports: ['PRISMA'],
})
export class PrismaModule {}

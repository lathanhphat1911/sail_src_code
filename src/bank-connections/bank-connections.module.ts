import { Module } from '@nestjs/common';
import { BankConnectionsService } from './bank-connections.service';
import { BankConnectionsController } from './bank-connections.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BankConnectionsController],
  providers: [BankConnectionsService, PrismaService],
  exports: [BankConnectionsService],
})
export class BankConnectionsModule {}

import { Module } from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { ContributionsController } from './contributions.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ContributionsController],
  providers: [ContributionsService, PrismaService],
  exports: [ContributionsService],
})
export class ContributionsModule {}

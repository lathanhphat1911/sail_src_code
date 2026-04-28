import { Module } from '@nestjs/common';
import { CrewsService } from './crews.service';
import { CrewsController } from './crews.controller';
import { PrismaService } from '../prisma.service'; 
import { CrewCronService } from './crew-cron.service';
@Module({
  controllers: [CrewsController],
  providers: [
    CrewsService, 
    PrismaService,
    CrewCronService
  ],
})
export class CrewsModule {}
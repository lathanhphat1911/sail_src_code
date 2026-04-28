import { Module } from '@nestjs/common';
import { CrewPeriodsService } from './crew-periods.service';
import { CrewPeriodsController } from './crew-periods.controller';

@Module({
  controllers: [CrewPeriodsController],
  providers: [CrewPeriodsService],
})
export class CrewPeriodsModule {}

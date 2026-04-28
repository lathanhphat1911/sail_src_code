import { Test, TestingModule } from '@nestjs/testing';
import { CrewPeriodsController } from './crew-periods.controller';
import { CrewPeriodsService } from './crew-periods.service';

describe('CrewPeriodsController', () => {
  let controller: CrewPeriodsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrewPeriodsController],
      providers: [CrewPeriodsService],
    }).compile();

    controller = module.get<CrewPeriodsController>(CrewPeriodsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CrewPeriodsService } from './crew-periods.service';

describe('CrewPeriodsService', () => {
  let service: CrewPeriodsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CrewPeriodsService],
    }).compile();

    service = module.get<CrewPeriodsService>(CrewPeriodsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

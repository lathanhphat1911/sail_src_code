import { Test, TestingModule } from '@nestjs/testing';
import { CrewsController } from './crews.controller';
import { CrewsService } from './crews.service';

describe('CrewsController', () => {
  let controller: CrewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrewsController],
      providers: [CrewsService],
    }).compile();

    controller = module.get<CrewsController>(CrewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

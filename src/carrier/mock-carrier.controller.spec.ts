import { Test, TestingModule } from '@nestjs/testing';
import { MockCarrierController } from './mock-carrier.controller';

describe('MockCarrierController', () => {
  let controller: MockCarrierController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MockCarrierController],
    }).compile();

    controller = module.get<MockCarrierController>(MockCarrierController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

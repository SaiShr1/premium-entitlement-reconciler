import { Test, TestingModule } from '@nestjs/testing';
import { MockCarrierService } from './mock-carrier.service';

describe('MockCarrierService', () => {
  let service: MockCarrierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockCarrierService],
    }).compile();

    service = module.get<MockCarrierService>(MockCarrierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  let service: EntitlementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntitlementsService],
    }).compile();

    service = module.get<EntitlementsService>(EntitlementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

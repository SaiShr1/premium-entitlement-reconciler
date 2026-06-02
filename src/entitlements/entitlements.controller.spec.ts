import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsController } from './entitlements.controller';

describe('EntitlementsController', () => {
  let controller: EntitlementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntitlementsController],
    }).compile();

    controller = module.get<EntitlementsController>(EntitlementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

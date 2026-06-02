import { Test, TestingModule } from '@nestjs/testing';
import { NotificationWorkerService } from './notification-worker.service';

describe('NotificationWorkerService', () => {
  let service: NotificationWorkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationWorkerService],
    }).compile();

    service = module.get<NotificationWorkerService>(NotificationWorkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

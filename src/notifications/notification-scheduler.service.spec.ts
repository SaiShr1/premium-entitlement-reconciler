import { Test, TestingModule } from '@nestjs/testing';
import { NotificationSchedulerService } from './notification-scheduler.service';

describe('NotificationSchedulerService', () => {
  let service: NotificationSchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationSchedulerService],
    }).compile();

    service = module.get<NotificationSchedulerService>(NotificationSchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

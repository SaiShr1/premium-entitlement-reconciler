import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as StatsD from 'hot-shots';

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private client: StatsD.StatsD;

  constructor() {
    this.client = new StatsD.StatsD({
      host: process.env.DD_AGENT_HOST || 'localhost',
      port: 8125,
      prefix: 'entitlement.',
      errorHandler: () => {}, // No-op — don't crash if agent unreachable
    });
  }

  increment(metric: string, tags?: Record<string, string>) {
    const tagArray = tags
      ? Object.entries(tags).map(([k, v]) => `${k}:${v}`)
      : [];
    this.client.increment(metric, 1, tagArray);
  }

  onModuleDestroy() {
    this.client.close();
  }
}
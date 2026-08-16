import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateWindow {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimiterService {
  private readonly windows = new Map<string, RateWindow>();

  constructor(private readonly configService: ConfigService) {}

  isAllowed(userId: string): boolean {
    const limit = this.configService.get<number>('MESSAGE_RATE_LIMIT')!;
    const windowMs =
      this.configService.get<number>('MESSAGE_RATE_LIMIT_WINDOW_SECONDS')! *
      1000;
    const now = Date.now();

    const current = this.windows.get(userId);
    if (!current || now - current.windowStart >= windowMs) {
      this.windows.set(userId, { count: 1, windowStart: now });
      return true;
    }

    if (current.count >= limit) {
      return false;
    }

    current.count += 1;
    return true;
  }
}

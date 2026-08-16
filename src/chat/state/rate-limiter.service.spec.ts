import { ConfigService } from '@nestjs/config';
import { RateLimiterService } from './rate-limiter.service';

function createConfig(limit: number, windowSeconds: number): ConfigService {
  const values: Record<string, number> = {
    MESSAGE_RATE_LIMIT: limit,
    MESSAGE_RATE_LIMIT_WINDOW_SECONDS: windowSeconds,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('RateLimiterService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('permite até o limite dentro da janela', () => {
    const service = new RateLimiterService(createConfig(3, 10));

    expect(service.isAllowed('user-1')).toBe(true);
    expect(service.isAllowed('user-1')).toBe(true);
    expect(service.isAllowed('user-1')).toBe(true);
  });

  it('bloqueia ao exceder o limite dentro da janela', () => {
    const service = new RateLimiterService(createConfig(2, 10));

    expect(service.isAllowed('user-1')).toBe(true);
    expect(service.isAllowed('user-1')).toBe(true);
    expect(service.isAllowed('user-1')).toBe(false);
  });

  it('usuários diferentes têm contadores independentes', () => {
    const service = new RateLimiterService(createConfig(1, 10));

    expect(service.isAllowed('user-1')).toBe(true);
    expect(service.isAllowed('user-2')).toBe(true);
  });

  it('reseta o contador após a janela expirar', () => {
    jest.useFakeTimers();
    const service = new RateLimiterService(createConfig(1, 10));

    expect(service.isAllowed('user-1')).toBe(true);
    expect(service.isAllowed('user-1')).toBe(false);

    jest.advanceTimersByTime(10_001);

    expect(service.isAllowed('user-1')).toBe(true);
  });
});

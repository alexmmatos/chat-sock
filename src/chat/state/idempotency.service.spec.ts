import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from './idempotency.service';

function createConfig(ttlSeconds: number): ConfigService {
  return { get: () => ttlSeconds } as unknown as ConfigService;
}

describe('IdempotencyService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('retorna null para um envio novo', () => {
    const service = new IdempotencyService(createConfig(300));
    expect(service.peek('sender-1', 'client-msg-1')).toBeNull();
    service.onModuleDestroy();
  });

  it('retorna o messageId salvo enquanto dentro da janela', () => {
    const service = new IdempotencyService(createConfig(300));
    service.set('sender-1', 'client-msg-1', 'message-abc');

    expect(service.peek('sender-1', 'client-msg-1')).toBe('message-abc');
    service.onModuleDestroy();
  });

  it('chaves diferentes (sender ou clientMessageId) não colidem', () => {
    const service = new IdempotencyService(createConfig(300));
    service.set('sender-1', 'client-msg-1', 'message-abc');

    expect(service.peek('sender-2', 'client-msg-1')).toBeNull();
    expect(service.peek('sender-1', 'client-msg-2')).toBeNull();
    service.onModuleDestroy();
  });

  it('expira após o TTL configurado', () => {
    jest.useFakeTimers();
    const service = new IdempotencyService(createConfig(1));
    service.set('sender-1', 'client-msg-1', 'message-abc');

    jest.advanceTimersByTime(1_001);

    expect(service.peek('sender-1', 'client-msg-1')).toBeNull();
    service.onModuleDestroy();
  });
});

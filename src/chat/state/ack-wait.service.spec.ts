import { ConfigService } from '@nestjs/config';
import { AckWaitService } from './ack-wait.service';

function createConfig(timeoutMs: number): ConfigService {
  return { get: () => timeoutMs } as unknown as ConfigService;
}

describe('AckWaitService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolve retorna a entrada e cancela o timeout dentro do prazo', () => {
    jest.useFakeTimers();
    const onTimeout = jest.fn();
    const service = new AckWaitService(createConfig(5000));

    service.register(
      'message-1',
      {
        senderId: 'a',
        clientMessageId: 'c1',
        recipientId: 'b',
        sentAt: new Date().toISOString(),
      },
      onTimeout,
    );
    const entry = service.resolve('message-1');

    expect(entry?.senderId).toBe('a');
    expect(entry?.clientMessageId).toBe('c1');
    expect(entry?.recipientId).toBe('b');
    expect(typeof entry?.sentAt).toBe('string');

    jest.advanceTimersByTime(6000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('resolve retorna null para messageId desconhecido (ack tardio/duplicado)', () => {
    const service = new AckWaitService(createConfig(5000));
    expect(service.resolve('unknown')).toBeNull();
  });

  it('dispara onTimeout quando o ACK não chega a tempo', () => {
    jest.useFakeTimers();
    const onTimeout = jest.fn();
    const service = new AckWaitService(createConfig(5000));

    service.register(
      'message-1',
      {
        senderId: 'a',
        clientMessageId: 'c1',
        recipientId: 'b',
        sentAt: new Date().toISOString(),
      },
      onTimeout,
    );
    jest.advanceTimersByTime(5000);

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(service.resolve('message-1')).toBeNull();
  });

  it('onModuleDestroy cancela todos os timers pendentes', () => {
    jest.useFakeTimers();
    const onTimeout = jest.fn();
    const service = new AckWaitService(createConfig(5000));
    service.register(
      'message-1',
      {
        senderId: 'a',
        clientMessageId: 'c1',
        recipientId: 'b',
        sentAt: new Date().toISOString(),
      },
      onTimeout,
    );

    service.onModuleDestroy();
    jest.advanceTimersByTime(10000);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});

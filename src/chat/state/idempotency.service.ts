import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface IdempotencyEntry {
  messageId: string;
  expiresAt: number;
}

const SWEEP_INTERVAL_MS = 60_000;

@Injectable()
export class IdempotencyService implements OnModuleDestroy {
  private readonly seen = new Map<string, IdempotencyEntry>();
  private readonly sweepInterval: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    this.sweepInterval = setInterval(
      () => this.sweepExpired(),
      SWEEP_INTERVAL_MS,
    );
  }

  /** Retorna o messageId de um envio anterior ainda dentro da janela, ou null se for um envio novo. */
  peek(senderId: string, clientMessageId: string): string | null {
    const entry = this.seen.get(this.key(senderId, clientMessageId));
    if (!entry || entry.expiresAt <= Date.now()) {
      return null;
    }
    return entry.messageId;
  }

  set(senderId: string, clientMessageId: string, messageId: string): void {
    const ttlMs =
      this.configService.get<number>('MESSAGE_IDEMPOTENCY_TTL_SECONDS')! * 1000;
    this.seen.set(this.key(senderId, clientMessageId), {
      messageId,
      expiresAt: Date.now() + ttlMs,
    });
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepInterval);
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.seen) {
      if (entry.expiresAt <= now) {
        this.seen.delete(key);
      }
    }
  }

  private key(senderId: string, clientMessageId: string): string {
    return `${senderId}:${clientMessageId}`;
  }
}

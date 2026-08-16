import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AckWaitEntry } from '../interfaces/ack-wait-entry.interface';

@Injectable()
export class AckWaitService implements OnModuleDestroy {
  private readonly pending = new Map<
    string,
    { entry: AckWaitEntry; timer: NodeJS.Timeout }
  >();

  constructor(private readonly configService: ConfigService) {}

  register(
    messageId: string,
    entry: AckWaitEntry,
    onTimeout: (entry: AckWaitEntry) => void,
  ): void {
    const timeoutMs = this.configService.get<number>('MESSAGE_ACK_TIMEOUT_MS')!;
    const timer = setTimeout(() => {
      this.pending.delete(messageId);
      onTimeout(entry);
    }, timeoutMs);

    this.pending.set(messageId, { entry, timer });
  }

  /** Cancela a espera e retorna a entrada, ou null se já expirou/não existir (ack tardio ou duplicado). */
  resolve(messageId: string): AckWaitEntry | null {
    const found = this.pending.get(messageId);
    if (!found) {
      return null;
    }

    clearTimeout(found.timer);
    this.pending.delete(messageId);
    return found.entry;
  }

  onModuleDestroy(): void {
    for (const { timer } of this.pending.values()) {
      clearTimeout(timer);
    }
    this.pending.clear();
  }
}

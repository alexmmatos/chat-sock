import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ChatErrorCode } from '../common/enums/chat-error-code.enum';
import { WsChatException } from '../common/exceptions/ws-chat.exception';
import { PresenceService } from '../presence/presence.service';
import { UsersService } from '../users/users.service';
import { MessageSendDto } from './dto/message-send.dto';
import { SendOutcome } from './interfaces/send-outcome.type';
import { IdempotencyService } from './state/idempotency.service';
import { RateLimiterService } from './state/rate-limiter.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly usersService: UsersService,
    private readonly presenceService: PresenceService,
    private readonly idempotencyService: IdempotencyService,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  async send(senderId: string, dto: MessageSendDto): Promise<SendOutcome> {
    if (!this.rateLimiterService.isAllowed(senderId)) {
      throw new WsChatException(
        ChatErrorCode.RATE_LIMITED,
        'Limite de mensagens excedido',
        dto.clientMessageId,
      );
    }

    if (this.idempotencyService.peek(senderId, dto.clientMessageId)) {
      return { kind: 'duplicate' };
    }

    const recipient = await this.usersService.findById(dto.recipientId);
    if (!recipient) {
      throw new WsChatException(
        ChatErrorCode.RECIPIENT_NOT_FOUND,
        'Destinatário não encontrado',
        dto.clientMessageId,
      );
    }

    if (dto.recipientId === senderId) {
      throw new WsChatException(
        ChatErrorCode.SELF_MESSAGE_NOT_ALLOWED,
        'Não é possível enviar mensagem para si mesmo',
        dto.clientMessageId,
      );
    }

    const recipientSocketIds = this.presenceService.getSocketIds(
      dto.recipientId,
    );
    if (recipientSocketIds.length === 0) {
      return {
        kind: 'offline',
        clientMessageId: dto.clientMessageId,
        recipientId: dto.recipientId,
      };
    }

    const sender = await this.usersService.findById(senderId);
    const messageId = randomUUID();
    this.idempotencyService.set(senderId, dto.clientMessageId, messageId);

    return {
      kind: 'delivered',
      messageId,
      clientMessageId: dto.clientMessageId,
      senderId,
      recipientId: dto.recipientId,
      recipientSocketIds,
      senderSocketIds: this.presenceService.getSocketIds(senderId),
      payload: {
        messageId,
        clientMessageId: dto.clientMessageId,
        sender: { id: sender!.id, name: sender!.name },
        content: dto.content,
        sentAt: new Date().toISOString(),
      },
    };
  }
}

import { WsException } from '@nestjs/websockets';
import { ChatErrorCode } from '../enums/chat-error-code.enum';

export class WsChatException extends WsException {
  constructor(
    public readonly code: ChatErrorCode,
    public readonly chatMessage: string,
    public readonly clientMessageId?: string,
    public readonly details: unknown[] = [],
  ) {
    super({ code, message: chatMessage, clientMessageId, details });
  }
}

import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Socket } from 'socket.io';
import { ChatErrorCode } from '../enums/chat-error-code.enum';
import { WsChatException } from '../exceptions/ws-chat.exception';

@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const requestId = randomUUID();

    if (exception instanceof WsChatException) {
      client.emit('chat:error', {
        requestId,
        clientMessageId: exception.clientMessageId,
        code: exception.code,
        message: exception.chatMessage,
        details: exception.details,
      });
      return;
    }

    this.logger.error(
      `Unhandled WS exception: ${exception instanceof Error ? exception.message : 'unknown'}`,
    );
    client.emit('chat:error', {
      requestId,
      code: ChatErrorCode.VALIDATION_ERROR,
      message: 'Ocorreu um erro ao processar o evento',
      details: [],
    });
  }
}

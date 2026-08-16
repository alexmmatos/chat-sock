import {
  Logger,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../auth/ws-auth.service';
import { ChatErrorCode } from '../common/enums/chat-error-code.enum';
import { WsChatException } from '../common/exceptions/ws-chat.exception';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import { AuthenticatedSocketData } from '../common/interfaces/authenticated-socket-data.interface';
import { MetricsService } from '../health/metrics.service';
import { PresenceService } from '../presence/presence.service';
import { ChatService } from './chat.service';
import { MessageAckDto } from './dto/message-ack.dto';
import { MessageSendDto } from './dto/message-send.dto';
import { PresenceCheckDto } from './dto/presence-check.dto';
import { MessageFailedPayload } from './interfaces/message-failed.interface';
import { AckWaitService } from './state/ack-wait.service';

// Decorators de gateway são avaliados antes da injeção de dependência existir,
// então CORS do WS não pode vir do ConfigService aqui — só process.env direto.
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsJwtGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new WsChatException(
        ChatErrorCode.VALIDATION_ERROR,
        'Payload inválido',
        undefined,
        errors,
      ),
  }),
)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly wsAuthService: WsAuthService,
    private readonly presenceService: PresenceService,
    private readonly chatService: ChatService,
    private readonly ackWaitService: AckWaitService,
    private readonly metricsService: MetricsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const payload = await this.wsAuthService.authenticate(client);
      (client.data as AuthenticatedSocketData).userId = payload.sub;
      this.metricsService.websocketConnectionsActive.inc();

      const justCameOnline = this.presenceService.registerConnection(
        payload.sub,
        client.id,
      );
      this.logger.log(
        `Conexão autenticada: userId=${payload.sub} socketId=${client.id}`,
      );
      if (justCameOnline) {
        this.notifyPresenceChanged(payload.sub, true);
      }
    } catch {
      this.logger.warn(`Conexão rejeitada: socketId=${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const result = this.presenceService.removeConnection(client.id);
    if (result) {
      this.metricsService.websocketConnectionsActive.dec();
      this.logger.log(
        `Desconexão: userId=${result.userId} socketId=${client.id}`,
      );
    }
    if (result?.wentOffline) {
      this.notifyPresenceChanged(result.userId, false);
    }
  }

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: MessageSendDto,
  ): Promise<void> {
    const senderId = (client.data as AuthenticatedSocketData).userId;
    const outcome = await this.chatService.send(senderId, dto);

    if (outcome.kind === 'duplicate') {
      return;
    }

    this.metricsService.messagesSentTotal.inc();

    if (outcome.kind === 'offline') {
      this.metricsService.messagesFailedTotal.inc({
        reason: 'RECIPIENT_OFFLINE',
      });
      const payload: MessageFailedPayload = {
        clientMessageId: outcome.clientMessageId,
        recipientId: outcome.recipientId,
        code: 'RECIPIENT_OFFLINE',
        message: 'O destinatário está offline.',
      };
      client.emit('message:failed', payload);
      return;
    }

    this.server
      .to(outcome.recipientSocketIds)
      .emit('message:received', outcome.payload);

    this.ackWaitService.register(
      outcome.messageId,
      {
        senderId: outcome.senderId,
        clientMessageId: outcome.clientMessageId,
        recipientId: outcome.recipientId,
        sentAt: outcome.payload.sentAt,
      },
      (entry) => {
        this.metricsService.messagesFailedTotal.inc({ reason: 'ACK_TIMEOUT' });
        const payload: MessageFailedPayload = {
          clientMessageId: entry.clientMessageId,
          recipientId: entry.recipientId,
          code: 'ACK_TIMEOUT',
          message: 'O destinatário não confirmou o recebimento a tempo.',
        };
        this.server
          .to(this.presenceService.getSocketIds(entry.senderId))
          .emit('message:failed', payload);
      },
    );
  }

  @SubscribeMessage('message:ack')
  handleMessageAck(@MessageBody() dto: MessageAckDto): void {
    const entry = this.ackWaitService.resolve(dto.messageId);
    if (!entry) {
      return;
    }

    this.metricsService.messagesDeliveredTotal.inc();
    this.metricsService.messageDeliveryDurationMs.observe(
      Date.now() - Date.parse(entry.sentAt),
    );

    this.server
      .to(this.presenceService.getSocketIds(entry.senderId))
      .emit('message:delivered', {
        messageId: dto.messageId,
        clientMessageId: entry.clientMessageId,
        recipientId: entry.recipientId,
        deliveredAt: new Date().toISOString(),
      });
  }

  @SubscribeMessage('presence:check')
  handlePresenceCheck(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: PresenceCheckDto,
  ) {
    this.presenceService.watch(client.id, dto.userId);
    return {
      userId: dto.userId,
      online: this.presenceService.isOnline(dto.userId),
    };
  }

  private notifyPresenceChanged(userId: string, online: boolean): void {
    const watcherSocketIds = this.presenceService.getWatcherSocketIds(userId);
    if (watcherSocketIds.length > 0) {
      this.server
        .to(watcherSocketIds)
        .emit('presence:changed', { userId, online });
    }
  }
}

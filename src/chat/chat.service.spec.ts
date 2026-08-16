import { PresenceService } from '../presence/presence.service';
import { UsersService } from '../users/users.service';
import { ChatErrorCode } from '../common/enums/chat-error-code.enum';
import { WsChatException } from '../common/exceptions/ws-chat.exception';
import { ChatService } from './chat.service';
import { IdempotencyService } from './state/idempotency.service';
import { RateLimiterService } from './state/rate-limiter.service';

describe('ChatService', () => {
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;
  let presenceService: jest.Mocked<Pick<PresenceService, 'getSocketIds'>>;
  let idempotencyService: jest.Mocked<Pick<IdempotencyService, 'peek' | 'set'>>;
  let rateLimiterService: jest.Mocked<Pick<RateLimiterService, 'isAllowed'>>;
  let service: ChatService;

  const sender = { id: 'sender-1', name: 'Sender' };
  const recipient = { id: 'recipient-1', name: 'Recipient' };

  beforeEach(() => {
    usersService = { findById: jest.fn() };
    presenceService = { getSocketIds: jest.fn().mockReturnValue([]) };
    idempotencyService = {
      peek: jest.fn().mockReturnValue(null),
      set: jest.fn(),
    };
    rateLimiterService = { isAllowed: jest.fn().mockReturnValue(true) };

    service = new ChatService(
      usersService as unknown as UsersService,
      presenceService as unknown as PresenceService,
      idempotencyService as unknown as IdempotencyService,
      rateLimiterService as unknown as RateLimiterService,
    );
  });

  const dto = {
    clientMessageId: 'client-1',
    recipientId: recipient.id,
    content: 'Olá',
  };

  it('lança RATE_LIMITED quando o limite foi excedido', async () => {
    rateLimiterService.isAllowed.mockReturnValue(false);

    await expect(service.send(sender.id, dto)).rejects.toMatchObject({
      code: ChatErrorCode.RATE_LIMITED,
    });
  });

  it('retorna duplicate quando já existe idempotência para a chave', async () => {
    idempotencyService.peek.mockReturnValue('previous-message-id');

    const result = await service.send(sender.id, dto);

    expect(result).toEqual({ kind: 'duplicate' });
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('lança RECIPIENT_NOT_FOUND quando o destinatário não existe', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(service.send(sender.id, dto)).rejects.toMatchObject({
      code: ChatErrorCode.RECIPIENT_NOT_FOUND,
    });
  });

  it('lança SELF_MESSAGE_NOT_ALLOWED quando recipientId === senderId', async () => {
    usersService.findById.mockResolvedValue({
      id: sender.id,
      name: sender.name,
    } as never);

    await expect(
      service.send(sender.id, { ...dto, recipientId: sender.id }),
    ).rejects.toMatchObject({
      code: ChatErrorCode.SELF_MESSAGE_NOT_ALLOWED,
    });
  });

  it('retorna offline quando o destinatário não tem sockets ativos', async () => {
    usersService.findById.mockResolvedValue(recipient as never);
    presenceService.getSocketIds.mockReturnValue([]);

    const result = await service.send(sender.id, dto);

    expect(result).toEqual({
      kind: 'offline',
      clientMessageId: dto.clientMessageId,
      recipientId: recipient.id,
    });
  });

  it('retorna delivered com o payload correto quando o destinatário está online', async () => {
    usersService.findById.mockImplementation((id) =>
      Promise.resolve((id === recipient.id ? recipient : sender) as never),
    );
    presenceService.getSocketIds.mockImplementation((id) =>
      id === recipient.id ? ['recipient-socket'] : ['sender-socket'],
    );

    const result = await service.send(sender.id, dto);

    expect(result.kind).toBe('delivered');
    if (result.kind === 'delivered') {
      expect(result.recipientSocketIds).toEqual(['recipient-socket']);
      expect(result.payload.sender).toEqual({
        id: sender.id,
        name: sender.name,
      });
      expect(result.payload.content).toBe(dto.content);
      expect(idempotencyService.set).toHaveBeenCalledWith(
        sender.id,
        dto.clientMessageId,
        result.messageId,
      );
    }
  });

  it('WsChatException carrega o clientMessageId para o cliente saber a qual envio o erro se refere', async () => {
    usersService.findById.mockResolvedValue(null);

    try {
      await service.send(sender.id, dto);
      throw new Error('deveria ter lançado');
    } catch (error) {
      expect(error).toBeInstanceOf(WsChatException);
      expect((error as WsChatException).clientMessageId).toBe(
        dto.clientMessageId,
      );
    }
  });
});

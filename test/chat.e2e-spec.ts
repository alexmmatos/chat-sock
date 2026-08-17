import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Chat gateway (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${typeof address === 'string' ? address : address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    while (openSockets.length > 0) {
      openSockets.pop()?.disconnect();
    }
  });

  function uniqueEmail(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  }

  async function registerUser(name: string, emailPrefix: string) {
    const email = uniqueEmail(emailPrefix);
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name, email, password: 'Senha@123' })
      .expect(201);
    return {
      token: response.body.accessToken as string,
      id: response.body.user.id as string,
    };
  }

  function connect(token?: string): Socket {
    const socket = io(baseUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    openSockets.push(socket);
    return socket;
  }

  function waitFor<T = unknown>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve) => socket.once(event, resolve));
  }

  it('conecta com JWT válido', async () => {
    const { token } = await registerUser('Conecta', 'connect');
    const socket = connect(token);

    await waitFor(socket, 'connect');
    expect(socket.connected).toBe(true);
  });

  it('rejeita conexão sem token', async () => {
    const socket = connect();
    await waitFor(socket, 'connect_error');
    expect(socket.connected).toBe(false);
  });

  it('envia mensagem entre dois usuários online e confirma entrega', async () => {
    const a = await registerUser('A', 'send-a');
    const b = await registerUser('B', 'send-b');
    const socketA = connect(a.token);
    const socketB = connect(b.token);
    await Promise.all([
      waitFor(socketA, 'connect'),
      waitFor(socketB, 'connect'),
    ]);

    socketB.on('message:received', (msg: { messageId: string }) =>
      socketB.emit('message:ack', { messageId: msg.messageId }),
    );

    const receivedPromise = waitFor<{
      content: string;
      sender: { id: string };
    }>(socketB, 'message:received');
    const deliveredPromise = waitFor<{ recipientId: string }>(
      socketA,
      'message:delivered',
    );

    socketA.emit('message:send', {
      clientMessageId: randomUUID(),
      recipientId: b.id,
      content: 'Olá, tudo bem?',
    });

    const received = await receivedPromise;
    expect(received.content).toBe('Olá, tudo bem?');
    expect(received.sender.id).toBe(a.id);

    const delivered = await deliveredPromise;
    expect(delivered.recipientId).toBe(b.id);
  });

  it('não confia no senderId enviado pelo cliente: payload com campo extra é rejeitado, nunca usado para forjar identidade', async () => {
    const a = await registerUser('A', 'forge-a');
    const b = await registerUser('B', 'forge-b');
    const victim = await registerUser('V', 'forge-v');
    const socketA = connect(a.token);
    const socketB = connect(b.token);
    await Promise.all([
      waitFor(socketA, 'connect'),
      waitFor(socketB, 'connect'),
    ]);

    const receivedPromise = waitFor<{ sender: { id: string } }>(
      socketB,
      'message:received',
    );
    const errorPromise = waitFor<{ code: string }>(socketA, 'chat:error');

    socketA.emit('message:send', {
      clientMessageId: randomUUID(),
      recipientId: b.id,
      content: 'mensagem',
      senderId: victim.id,
    });

    // whitelist/forbidNonWhitelisted rejeita o campo extra inteiro (VALIDATION_ERROR).
    // Em nenhum caso a mensagem chega a B com a identidade forjada de "victim".
    const error = await errorPromise;
    expect(error.code).toBe('VALIDATION_ERROR');

    let forgedDelivery: { sender: { id: string } } | undefined;
    void receivedPromise.then((msg) => {
      forgedDelivery = msg;
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(forgedDelivery).toBeUndefined();
  });

  it('envio para usuário offline falha imediatamente', async () => {
    const a = await registerUser('A', 'offline-a');
    const offlineUser = await registerUser('Offline', 'offline-b');
    const socketA = connect(a.token);
    await waitFor(socketA, 'connect');

    const failedPromise = waitFor<{ code: string }>(socketA, 'message:failed');
    socketA.emit('message:send', {
      clientMessageId: randomUUID(),
      recipientId: offlineUser.id,
      content: 'ninguém em casa',
    });

    const failed = await failedPromise;
    expect(failed.code).toBe('RECIPIENT_OFFLINE');
  });

  it('bloqueia autoenvio', async () => {
    const a = await registerUser('A', 'self-a');
    const socketA = connect(a.token);
    await waitFor(socketA, 'connect');

    const errorPromise = waitFor<{ code: string }>(socketA, 'chat:error');
    socketA.emit('message:send', {
      clientMessageId: randomUUID(),
      recipientId: a.id,
      content: 'oi eu mesmo',
    });

    const error = await errorPromise;
    expect(error.code).toBe('SELF_MESSAGE_NOT_ALLOWED');
  });

  it('rejeita payload inválido (recipientId não é UUID)', async () => {
    const a = await registerUser('A', 'invalid-a');
    const socketA = connect(a.token);
    await waitFor(socketA, 'connect');

    const errorPromise = waitFor<{ code: string }>(socketA, 'chat:error');
    socketA.emit('message:send', {
      clientMessageId: randomUUID(),
      recipientId: 'not-a-uuid',
      content: 'x',
    });

    expect((await errorPromise).code).toBe('VALIDATION_ERROR');
  });

  it('rejeita conteúdo vazio', async () => {
    const a = await registerUser('A', 'empty-a');
    const b = await registerUser('B', 'empty-b');
    const socketA = connect(a.token);
    await waitFor(socketA, 'connect');

    const errorPromise = waitFor<{ code: string }>(socketA, 'chat:error');
    socketA.emit('message:send', {
      clientMessageId: randomUUID(),
      recipientId: b.id,
      content: '   ',
    });

    expect((await errorPromise).code).toBe('VALIDATION_ERROR');
  });

  it('rejeita mensagem acima de 2000 caracteres', async () => {
    const a = await registerUser('A', 'toolong-a');
    const b = await registerUser('B', 'toolong-b');
    const socketA = connect(a.token);
    await waitFor(socketA, 'connect');

    const errorPromise = waitFor<{ code: string }>(socketA, 'chat:error');
    socketA.emit('message:send', {
      clientMessageId: randomUUID(),
      recipientId: b.id,
      content: 'x'.repeat(2001),
    });

    expect((await errorPromise).code).toBe('VALIDATION_ERROR');
  });

  it('envio duplicado com o mesmo clientMessageId não gera uma segunda entrega', async () => {
    const a = await registerUser('A', 'dup-a');
    const b = await registerUser('B', 'dup-b');
    const socketA = connect(a.token);
    const socketB = connect(b.token);
    await Promise.all([
      waitFor(socketA, 'connect'),
      waitFor(socketB, 'connect'),
    ]);

    const clientMessageId = randomUUID();
    let receivedCount = 0;
    socketB.on('message:received', () => {
      receivedCount += 1;
    });

    socketA.emit('message:send', {
      clientMessageId,
      recipientId: b.id,
      content: 'primeira',
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    socketA.emit('message:send', {
      clientMessageId,
      recipientId: b.id,
      content: 'primeira',
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(receivedCount).toBe(1);
  });

  it('entrega para todas as conexões ativas do destinatário', async () => {
    const a = await registerUser('A', 'multi-a');
    const b = await registerUser('B', 'multi-b');
    const socketA = connect(a.token);
    const socketB1 = connect(b.token);
    const socketB2 = connect(b.token);
    await Promise.all([
      waitFor(socketA, 'connect'),
      waitFor(socketB1, 'connect'),
      waitFor(socketB2, 'connect'),
    ]);

    const received1 = waitFor(socketB1, 'message:received');
    const received2 = waitFor(socketB2, 'message:received');

    socketA.emit('message:send', {
      clientMessageId: randomUUID(),
      recipientId: b.id,
      content: 'para os dois',
    });

    await Promise.all([received1, received2]);
  });

  it('usuário permanece online enquanto ainda tem outra conexão ativa', async () => {
    const a = await registerUser('A', 'stillonline-a');
    const b = await registerUser('B', 'stillonline-b');
    const socketA = connect(a.token);
    const socketB1 = connect(b.token);
    const socketB2 = connect(b.token);
    await Promise.all([
      waitFor(socketA, 'connect'),
      waitFor(socketB1, 'connect'),
      waitFor(socketB2, 'connect'),
    ]);

    socketB1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const checkPromise = new Promise<{ online: boolean }>((resolve) =>
      socketA.emit('presence:check', { userId: b.id }, resolve),
    );
    const check = await checkPromise;

    expect(check.online).toBe(true);
  });

  it('timeout sem ACK gera message:failed com ACK_TIMEOUT', async () => {
    const a = await registerUser('A', 'timeout-a');
    const b = await registerUser('B', 'timeout-b');
    const socketA = connect(a.token);
    const socketB = connect(b.token);
    await Promise.all([
      waitFor(socketA, 'connect'),
      waitFor(socketB, 'connect'),
    ]);
    // socketB recebe mas nunca emite message:ack de propósito

    const failedPromise = waitFor<{ code: string }>(socketA, 'message:failed');
    socketA.emit('message:send', {
      clientMessageId: randomUUID(),
      recipientId: b.id,
      content: 'você está aí?',
    });

    const failed = await failedPromise;
    expect(failed.code).toBe('ACK_TIMEOUT');
  }, 10_000);

  it('aplica rate limiting após exceder o limite configurado', async () => {
    const a = await registerUser('A', 'ratelimit-a');
    const b = await registerUser('B', 'ratelimit-b');
    const socketA = connect(a.token);
    await waitFor(socketA, 'connect');

    const errors: string[] = [];
    socketA.on('chat:error', (err: { code: string }) => errors.push(err.code));

    for (let i = 0; i < 25; i += 1) {
      socketA.emit('message:send', {
        clientMessageId: randomUUID(),
        recipientId: b.id,
        content: `msg ${i}`,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(errors).toContain('RATE_LIMITED');
  });
});

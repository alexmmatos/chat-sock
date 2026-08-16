import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueEmail(): string {
    return `auth-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  }

  it('cadastra com sucesso e não retorna passwordHash', async () => {
    const email = uniqueEmail();

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Alexandre Matos', email, password: 'Senha@123' })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(email);
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejeita e-mail duplicado com 409', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'A', email, password: 'Senha@123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'A de novo',
        email: email.toUpperCase(),
        password: 'Senha@123',
      })
      .expect(409);
  });

  it('rejeita payload de cadastro inválido', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: '', email: 'not-an-email', password: '123' })
      .expect(400);
  });

  it('login válido retorna token e usuário', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'A', email, password: 'Senha@123' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Senha@123' })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it('login com e-mail inexistente e com senha errada retornam a mesma mensagem', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'A', email, password: 'Senha@123' })
      .expect(201);

    const unknownEmailRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: uniqueEmail(), password: 'qualquer' })
      .expect(401);

    const wrongPasswordRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'errada' })
      .expect(401);

    expect(unknownEmailRes.body.message).toBe(wrongPasswordRes.body.message);
  });
});

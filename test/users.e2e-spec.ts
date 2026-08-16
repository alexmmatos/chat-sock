import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Users (e2e)', () => {
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
      email,
    };
  }

  it('GET /users/me retorna o próprio usuário sem passwordHash', async () => {
    const { token, email } = await registerUser('Alexandre Matos', 'me');

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.email).toBe(email);
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('rejeita acesso sem token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('GET /users exclui o próprio usuário por padrão e mostra status online', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const a = await registerUser(`Search Target ${suffix}`, 'list-a');
    const b = await registerUser(`Other User ${suffix}`, 'list-b');

    const response = await request(app.getHttpServer())
      .get(`/users?search=${encodeURIComponent(suffix)}&limit=50`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);

    const ids = response.body.data.map((u: { id: string }) => u.id);
    expect(ids).not.toContain(a.id);
    expect(ids).toContain(b.id);
    expect(
      response.body.data.every(
        (u: { online: boolean }) => typeof u.online === 'boolean',
      ),
    ).toBe(true);
  });

  it('GET /users/:id retorna 404 para usuário inexistente', async () => {
    const { token } = await registerUser('Alexandre', '404');

    await request(app.getHttpServer())
      .get('/users/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});

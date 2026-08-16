import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let usersService: jest.Mocked<
    Pick<UsersService, 'findByEmail' | 'create' | 'toResponse'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let service: AuthService;

  const storedUser = {
    id: 'user-1',
    name: 'Alexandre Matos',
    email: 'alexandre@example.com',
    passwordHash: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeAll(async () => {
    storedUser.passwordHash = await bcrypt.hash('Senha@123', 10);
  });

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      toResponse: jest.fn((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      })),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('cadastra com sucesso e normaliza o e-mail', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...storedUser,
        email: 'alexandre@example.com',
      });

      const result = await service.register({
        name: '  Alexandre Matos  ',
        email: 'Alexandre@Example.com',
        password: 'Senha@123',
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'alexandre@example.com',
      );
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alexandre Matos',
          email: 'alexandre@example.com',
        }),
      );
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejeita e-mail duplicado', async () => {
      usersService.findByEmail.mockResolvedValue(storedUser);

      await expect(
        service.register({
          name: 'Alexandre',
          email: 'alexandre@example.com',
          password: 'Senha@123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('autentica com credenciais válidas', async () => {
      usersService.findByEmail.mockResolvedValue(storedUser);

      const result = await service.login({
        email: 'alexandre@example.com',
        password: 'Senha@123',
      });

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejeita e-mail inexistente com mensagem genérica', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'inexistente@example.com',
          password: 'qualquer',
        }),
      ).rejects.toThrow('Credenciais inválidas');
    });

    it('rejeita senha errada com a mesma mensagem genérica', async () => {
      usersService.findByEmail.mockResolvedValue(storedUser);

      await expect(
        service.login({ email: 'alexandre@example.com', password: 'errada' }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
    });
  });
});

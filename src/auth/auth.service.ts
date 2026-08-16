import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { normalizeEmail } from './normalize-email';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = normalizeEmail(dto.email);

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.usersService.create({
      name: dto.name.trim(),
      email,
      passwordHash,
    });

    return this.buildAuthResponse(
      user.id,
      user.email,
      this.usersService.toResponse(user),
    );
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const email = normalizeEmail(dto.email);
    const invalidCredentials = new UnauthorizedException(
      'Credenciais inválidas',
    );

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw invalidCredentials;
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw invalidCredentials;
    }

    return this.buildAuthResponse(
      user.id,
      user.email,
      this.usersService.toResponse(user),
    );
  }

  private buildAuthResponse(
    userId: string,
    email: string,
    user: AuthResponseDto['user'],
  ): AuthResponseDto {
    const payload: JwtPayload = { sub: userId, email };
    return { accessToken: this.jwtService.sign(payload), user };
  }
}

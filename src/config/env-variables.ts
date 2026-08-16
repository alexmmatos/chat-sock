import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string;

  @IsInt()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string;

  @IsString()
  CORS_ORIGIN: string;

  @IsInt()
  @Min(1)
  MESSAGE_ACK_TIMEOUT_MS: number;

  @IsInt()
  @Min(1)
  MESSAGE_IDEMPOTENCY_TTL_SECONDS: number;

  @IsInt()
  @Min(1)
  MESSAGE_RATE_LIMIT: number;

  @IsInt()
  @Min(1)
  MESSAGE_RATE_LIMIT_WINDOW_SECONDS: number;
}

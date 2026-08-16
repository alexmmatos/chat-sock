import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'Alexandre Matos',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({
    description: 'E-mail do usuário (será normalizado para lowercase)',
    format: 'email',
    example: 'alexandre@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Senha com no mínimo 8 caracteres, contendo ao menos uma letra e um número',
    minLength: 8,
    example: 'Senha@123',
  })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password deve conter ao menos uma letra e um número',
  })
  password: string;
}

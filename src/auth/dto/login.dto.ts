import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail cadastrado',
    format: 'email',
    example: 'alexandre@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Senha', example: 'Senha@123' })
  @IsString()
  @MinLength(1)
  password: string;
}

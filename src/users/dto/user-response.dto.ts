import { ApiProperty } from '@nestjs/swagger';

/** Representação pública de um usuário. Nunca inclui passwordHash (INV-08). */
export class UserResponseDto {
  @ApiProperty({
    description: 'Identificador único do usuário',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
  })
  id: string;

  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'Alexandre Matos',
  })
  name: string;

  @ApiProperty({
    description: 'E-mail normalizado (lowercase, sem espaços)',
    example: 'alexandre@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Data de criação do usuário',
    example: '2026-08-16T03:00:00.000Z',
  })
  createdAt: Date;
}

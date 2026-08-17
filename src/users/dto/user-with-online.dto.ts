import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

/** Usuário público com status de presença, usado na listagem e na consulta por ID. */
export class UserWithOnlineDto extends UserResponseDto {
  @ApiProperty({
    description: 'Se o usuário tem ao menos uma conexão WebSocket ativa',
    example: true,
  })
  online: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import { UserWithOnlineDto } from './user-with-online.dto';

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserWithOnlineDto] })
  data: UserWithOnlineDto[];

  @ApiProperty({
    example: 42,
    description: 'Total de usuários que atendem ao filtro',
  })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

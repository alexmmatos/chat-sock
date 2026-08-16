import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PresenceService } from '../presence/presence.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { PaginatedUsersDto } from './dto/paginated-users.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserWithOnlineDto } from './dto/user-with-online.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly presenceService: PresenceService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Usuário autenticado',
    description: 'Retorna os dados do usuário dono do token enviado.',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  me(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.usersService
      .findById(user.sub)
      .then((entity) => this.usersService.toResponse(entity!));
  }

  @Get()
  @ApiOperation({
    summary: 'Lista usuários',
    description:
      'Lista paginada de usuários, com busca por nome. Exclui o próprio usuário autenticado por padrão; use includeSelf=true para incluí-lo.',
  })
  @ApiResponse({ status: 200, type: PaginatedUsersDto })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  async list(
    @Query() query: ListUsersQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedUsersDto> {
    const { items, total } = await this.usersService.findMany(query, user.sub);

    const data: UserWithOnlineDto[] = items.map((item) => ({
      ...this.usersService.toResponse(item),
      online: this.presenceService.isOnline(item.id),
    }));

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 0,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulta um usuário',
    description:
      'Retorna dados públicos e status online de um usuário pelo ID.',
  })
  @ApiParam({ name: 'id', description: 'ID do usuário', format: 'uuid' })
  @ApiResponse({ status: 200, type: UserWithOnlineDto })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, inválido ou expirado',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserWithOnlineDto> {
    const entity = await this.usersService.findById(id);
    if (!entity) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      ...this.usersService.toResponse(entity),
      online: this.presenceService.isOnline(entity.id),
    };
  }
}

import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness',
    description:
      'Responde 200 se o processo está vivo, sem checar dependências externas.',
  })
  @ApiResponse({ status: 200, description: 'Processo vivo' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness',
    description: 'Responde 200 apenas se o PostgreSQL está alcançável.',
  })
  @ApiResponse({ status: 200, description: 'Pronto para receber tráfego' })
  @ApiResponse({ status: 503, description: 'Dependência indisponível' })
  async ready(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.status(HttpStatus.OK).json({ status: 'ok', postgres: 'ok' });
    } catch {
      res
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .json({ status: 'error', postgres: 'unreachable' });
    }
  }
}

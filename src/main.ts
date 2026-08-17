import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const REST_BODY_LIMIT = '100kb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(express.json({ limit: REST_BODY_LIMIT }));
  app.enableCors({ origin: configService.get<string>('CORS_ORIGIN') });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const documentConfig = new DocumentBuilder()
    .setTitle('P2P Chat API')
    .setDescription(
      'API de chat individual (P2P mediado por servidor) em tempo real. ' +
        'Não existem salas, grupos, canais, histórico ou persistência de mensagens: ' +
        'o conteúdo trafega apenas durante a transmissão via WebSocket. ' +
        'Fluxo de chat: cliente conecta ao WebSocket com o JWT emitido por /auth/login, ' +
        'emite message:send, o destinatário recebe message:received e confirma com ' +
        'message:ack, e o remetente recebe message:delivered (ou message:failed se o ' +
        'destinatário estiver offline ou não confirmar a tempo). Eventos WebSocket não ' +
        'aparecem nas rotas abaixo; são documentados em specs/03-chat-gateway.md e no README.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Cadastro, login e emissão de JWT')
    .addTag('Users', 'Perfil, listagem e consulta de usuários')
    .addTag('Health', 'Liveness e readiness da aplicação')
    .build();
  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(configService.get<number>('PORT') ?? 3000);
}

void bootstrap();

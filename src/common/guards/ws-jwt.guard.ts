import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthenticatedSocketData } from '../interfaces/authenticated-socket-data.interface';

@Injectable()
export class WsJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const data = client.data as Partial<AuthenticatedSocketData>;

    if (!data.userId) {
      throw new WsException('UNAUTHORIZED');
    }

    return true;
  }
}

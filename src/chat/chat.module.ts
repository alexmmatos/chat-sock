import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { UsersModule } from '../users/users.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { AckWaitService } from './state/ack-wait.service';
import { IdempotencyService } from './state/idempotency.service';
import { RateLimiterService } from './state/rate-limiter.service';

@Module({
  imports: [AuthModule, UsersModule, PresenceModule],
  providers: [
    ChatGateway,
    ChatService,
    IdempotencyService,
    AckWaitService,
    RateLimiterService,
  ],
})
export class ChatModule {}

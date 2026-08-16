import { IsUUID } from 'class-validator';

export class PresenceCheckDto {
  @IsUUID('4')
  userId: string;
}

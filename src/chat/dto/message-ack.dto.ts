import { IsUUID } from 'class-validator';

export class MessageAckDto {
  @IsUUID('4')
  messageId: string;
}

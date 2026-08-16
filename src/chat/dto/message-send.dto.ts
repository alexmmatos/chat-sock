import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class MessageSendDto {
  @IsUUID('4')
  clientMessageId: string;

  @IsUUID('4')
  recipientId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

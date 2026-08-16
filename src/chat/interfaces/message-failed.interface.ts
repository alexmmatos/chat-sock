export interface MessageFailedPayload {
  clientMessageId: string;
  recipientId: string;
  code: 'RECIPIENT_OFFLINE' | 'ACK_TIMEOUT';
  message: string;
}

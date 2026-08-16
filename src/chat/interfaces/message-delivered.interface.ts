export interface MessageDeliveredPayload {
  messageId: string;
  clientMessageId: string;
  recipientId: string;
  deliveredAt: string;
}

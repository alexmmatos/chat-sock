export interface AckWaitEntry {
  senderId: string;
  clientMessageId: string;
  recipientId: string;
  sentAt: string;
}

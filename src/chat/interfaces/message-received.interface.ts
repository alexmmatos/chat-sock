export interface MessageReceivedPayload {
  messageId: string;
  clientMessageId: string;
  sender: { id: string; name: string };
  content: string;
  sentAt: string;
}

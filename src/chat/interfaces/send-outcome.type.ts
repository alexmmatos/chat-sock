import { MessageReceivedPayload } from './message-received.interface';

export type SendOutcome =
  | { kind: 'duplicate' }
  | { kind: 'offline'; clientMessageId: string; recipientId: string }
  | {
      kind: 'delivered';
      messageId: string;
      clientMessageId: string;
      senderId: string;
      recipientId: string;
      recipientSocketIds: string[];
      senderSocketIds: string[];
      payload: MessageReceivedPayload;
    };

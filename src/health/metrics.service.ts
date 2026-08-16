import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly websocketConnectionsActive = new Gauge({
    name: 'websocket_connections_active',
    help: 'Número de conexões WebSocket ativas',
    registers: [this.registry],
  });

  readonly messagesSentTotal = new Counter({
    name: 'messages_sent_total',
    help: 'Total de mensagens aceitas para envio',
    registers: [this.registry],
  });

  readonly messagesDeliveredTotal = new Counter({
    name: 'messages_delivered_total',
    help: 'Total de mensagens confirmadas com ACK',
    registers: [this.registry],
  });

  readonly messagesFailedTotal = new Counter({
    name: 'messages_failed_total',
    help: 'Total de mensagens que falharam na entrega',
    labelNames: ['reason'],
    registers: [this.registry],
  });

  readonly messageDeliveryDurationMs = new Histogram({
    name: 'message_delivery_duration_ms',
    help: 'Tempo entre o envio e a confirmação de entrega (ACK), em ms',
    buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [this.registry],
  });
}

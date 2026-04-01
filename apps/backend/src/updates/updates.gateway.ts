import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────────────────────
// UpdatesGateway — /updates namespace
//
// Broadcasts real-time status changes to subscribed clients without requiring
// a full screen refresh. Covers:
//   • Order status changes  → event: "orderStatusChanged"
//   • Transport job status  → event: "jobStatusChanged"
//   • Job location updates  → event: "jobLocationChanged"
//
// Client usage:
//   const socket = io(`${WS_URL}/updates`, { auth: { token } });
//   socket.emit('watchOrder', { orderId });
//   socket.on('orderStatusChanged', ({ orderId, status }) => { ... });
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderStatusPayload {
  orderId: string;
  status: string;
}

export interface JobStatusPayload {
  jobId: string;
  status: string;
  orderId?: string;
}

export interface JobLocationPayload {
  jobId: string;
  lat: number;
  lng: number;
}

export interface SellerNewOrderPayload {
  companyId: string;
  orderId: string;
  orderNumber: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const raw =
        process.env.ALLOWED_ORIGIN ?? process.env.CORS_ORIGIN ?? '';
      const allowed = raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      if (
        process.env.NODE_ENV !== 'production' ||
        !allowed.length ||
        !origin ||
        allowed.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  namespace: '/updates',
})
export class UpdatesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(UpdatesGateway.name);
  private readonly jwtSecret: string;

  constructor(private readonly config: ConfigService) {
    this.jwtSecret = this.config.get<string>('JWT_SECRET') ?? 'your-secret-key';
  }

  // ── Connection lifecycle ────────────────────────────────────────────────────

  handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }
    const payload = this.verifyToken(token);
    if (!payload) {
      client.disconnect();
      return;
    }
    (client.data as Record<string, unknown>).userId = payload.sub;
    this.logger.debug(`[Updates WS] Connected: ${String(payload.sub)} (${client.id})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`[Updates WS] Disconnected: ${client.id}`);
  }

  // ── Client subscriptions ───────────────────────────────────────────────────

  /** Subscribe to status and location changes for a specific order. */
  @SubscribeMessage('watchOrder')
  handleWatchOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (!data?.orderId) throw new WsException('orderId is required');
    void client.join(`order:${data.orderId}`);
    return { ok: true };
  }

  @SubscribeMessage('unwatchOrder')
  handleUnwatchOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (!data?.orderId) return;
    void client.leave(`order:${data.orderId}`);
  }

  /** Subscribe to status and location changes for a specific transport job. */
  @SubscribeMessage('watchJob')
  handleWatchJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    if (!data?.jobId) throw new WsException('jobId is required');
    void client.join(`job:${data.jobId}`);
    return { ok: true };
  }

  @SubscribeMessage('unwatchJob')
  handleUnwatchJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    if (!data?.jobId) return;
    void client.leave(`job:${data.jobId}`);
  }

  /** Subscribe to all order events for a seller company (new orders, cancellations). */
  @SubscribeMessage('watchSeller')
  handleWatchSeller(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { companyId: string },
  ) {
    if (!data?.companyId) throw new WsException('companyId is required');
    void client.join(`seller:${data.companyId}`);
    return { ok: true };
  }

  @SubscribeMessage('unwatchSeller')
  handleUnwatchSeller(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { companyId: string },
  ) {
    if (!data?.companyId) return;
    void client.leave(`seller:${data.companyId}`);
  }

  // ── Called by service layer after DB updates ──────────────────────────────

  broadcastOrderStatus(payload: OrderStatusPayload) {
    this.server.to(`order:${payload.orderId}`).emit('orderStatusChanged', payload);
  }

  broadcastJobStatus(payload: JobStatusPayload) {
    this.server.to(`job:${payload.jobId}`).emit('jobStatusChanged', payload);
    // If the job is linked to an order, also notify order watchers
    if (payload.orderId) {
      this.server.to(`order:${payload.orderId}`).emit('jobStatusChanged', payload);
    }
  }

  broadcastJobLocation(payload: JobLocationPayload) {
    this.server.to(`job:${payload.jobId}`).emit('jobLocationChanged', payload);
  }

  broadcastSellerNewOrder(payload: SellerNewOrderPayload) {
    this.server.to(`seller:${payload.companyId}`).emit('sellerNewOrder', payload);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as Record<string, unknown>)
      .token as string | undefined;
    if (authToken) return authToken.replace(/^Bearer\s+/i, '');
    const query = client.handshake.query?.token as string | undefined;
    if (query) return query.replace(/^Bearer\s+/i, '');
    return null;
  }

  private verifyToken(token: string): jwt.JwtPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
    } catch {
      return null;
    }
  }
}

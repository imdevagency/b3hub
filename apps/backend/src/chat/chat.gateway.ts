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
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─────────────────────────────────────────────────────────────────────────────
// Gateway
// Clients connect with: socket({ auth: { token: '<jwt>' } })
// Then emit joinJob({ jobId }) to subscribe to a job room.
// ─────────────────────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: {
    origin: '*', // tighten in production
    credentials: false,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly jwtSecret: string;

  constructor(private readonly config: ConfigService) {
    this.jwtSecret = this.config.get<string>('JWT_SECRET') ?? 'your-secret-key';
  }

  // ── Connection lifecycle ──────────────────────────────────────────────────

  handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`[WS] Rejected connection — no token (${client.id})`);
      client.disconnect();
      return;
    }

    const payload = this.verifyToken(token);
    if (!payload) {
      this.logger.warn(`[WS] Rejected connection — invalid token (${client.id})`);
      client.disconnect();
      return;
    }

    // Attach userId to socket for later use
    (client as any).userId = payload.sub as string;
    this.logger.debug(`[WS] Connected: ${payload.sub} (${client.id})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`[WS] Disconnected: ${client.id}`);
  }

  // ── Events from client ────────────────────────────────────────────────────

  /** Client emits this to start receiving messages for a job. */
  @SubscribeMessage('joinJob')
  handleJoinJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    if (!data?.jobId) throw new WsException('jobId is required');
    const room = `job:${data.jobId}`;
    client.join(room);
    this.logger.debug(`[WS] ${(client as any).userId} joined ${room}`);
    return { ok: true, room };
  }

  /** Client emits this when navigating away from the chat screen. */
  @SubscribeMessage('leaveJob')
  handleLeaveJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string },
  ) {
    if (!data?.jobId) return;
    client.leave(`job:${data.jobId}`);
  }

  // ── Called by ChatService after persisting a message ──────────────────────

  broadcastMessage(jobId: string, message: {
    id: string;
    senderId: string;
    senderName: string;
    body: string;
    createdAt: Date;
  }) {
    this.server.to(`job:${jobId}`).emit('newMessage', message);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private extractToken(client: Socket): string | null {
    // Preferred: socket auth object { token: 'Bearer xxx' or 'xxx' }
    const authToken = (client.handshake.auth as any)?.token as string | undefined;
    if (authToken) return authToken.replace(/^Bearer\s+/i, '');

    // Fallback: ?token= query param
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

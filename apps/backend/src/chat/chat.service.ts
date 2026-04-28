/**
 * Chat service.
 * Manages 1-to-1 and order-scoped conversations.
 * Stores messages in the DB and supports paginated message history.
 * Real-time delivery is handled via the Chat WebSocket gateway.
 */
import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  Optional,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatGateway } from './chat.gateway';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway: ChatGateway,
    @Optional() private readonly supabase: SupabaseService,
  ) {}

  /** Verify the requesting user is the buyer or a seller with materials in the order. */
  private async assertOrderAccess(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        createdById: true,
        items: { select: { material: { select: { supplierId: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isBuyer = order.createdById === userId;
    const isSeller = order.items.some((i) => i.material?.supplierId === userId);

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('You are not a participant in this order');
    }
    return order;
  }

  /** Verify the requesting user is the driver or the order creator. */
  private async assertAccess(jobId: string, userId: string) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id: jobId },
      select: {
        driverId: true,
        requestedById: true,
        order: { select: { createdById: true } },
      },
    });
    if (!job) throw new NotFoundException('Transport job not found');

    const isDriver = job.driverId === userId;
    const isBuyer =
      job.order?.createdById === userId || job.requestedById === userId;

    if (!isDriver && !isBuyer) {
      throw new ForbiddenException('You are not a participant in this job');
    }

    return job;
  }

  async getMyRooms(userId: string) {
    const [jobs, orderMsgs] = await Promise.all([
      this.prisma.transportJob.findMany({
        where: {
          chatMessages: { some: {} },
          OR: [
            { driverId: userId },
            { requestedById: userId },
            { order: { createdById: userId } },
          ],
        },
        select: {
          id: true,
          jobNumber: true,
          jobType: true,
          cargoType: true,
          pickupCity: true,
          deliveryCity: true,
          status: true,
          driverId: true,
          requestedById: true,
          driver: { select: { id: true, firstName: true, lastName: true } },
          order: { select: { createdById: true, createdBy: { select: { id: true, firstName: true, lastName: true } } } },
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              body: true,
              senderName: true,
              createdAt: true,
              imageUrl: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.chatMessage.findMany({
        where: {
          orderId: { not: null },
          OR: [
            { order: { createdById: userId } },
            {
              order: { items: { some: { material: { supplierId: userId } } } },
            },
          ],
        },
        distinct: ['orderId'],
        orderBy: { createdAt: 'desc' },
        select: {
          orderId: true,
          body: true,
          senderName: true,
          createdAt: true,
          imageUrl: true,
          order: {
            select: {
              orderNumber: true,
              status: true,
              deliveryCity: true,
            },
          },
        },
      }),
    ]);

    const jobRooms = jobs.map((j) => {
      const iAmDriver = j.driverId === userId;
      const other = iAmDriver
        ? j.order?.createdBy ?? null
        : j.driver ?? null;
      const otherParticipantId = other?.id ?? null;
      const otherParticipantName = other
        ? `${other.firstName} ${other.lastName}`.trim()
        : null;

      return {
        type: 'job' as const,
        jobId: j.id,
        jobNumber: j.jobNumber,
        jobType: j.jobType,
        cargoType: j.cargoType,
        pickupCity: j.pickupCity,
        deliveryCity: j.deliveryCity,
        status: j.status,
        otherParticipantId,
        otherParticipantName,
        lastMessage: j.chatMessages[0] ?? null,
      };
    });

    const orderRooms = orderMsgs
      .filter((m) => m.orderId && m.order)
      .map((m) => ({
        type: 'order' as const,
        orderId: m.orderId!,
        orderNumber: m.order!.orderNumber,
        status: m.order!.status,
        deliveryCity: m.order!.deliveryCity,
        lastMessage: {
          body: m.body,
          senderName: m.senderName,
          createdAt: m.createdAt,
          imageUrl: m.imageUrl,
        },
      }));

    return [...jobRooms, ...orderRooms].sort(
      (a, b) =>
        new Date(b.lastMessage?.createdAt ?? 0).getTime() -
        new Date(a.lastMessage?.createdAt ?? 0).getTime(),
    );
  }

  async getMessages(jobId: string, userId: string) {
    await this.assertAccess(jobId, userId);

    // Mark this chat as read for the current user
    await this.upsertLastRead(userId, { transportJobId: jobId });

    return this.prisma.chatMessage.findMany({
      where: { transportJobId: jobId },
      orderBy: { createdAt: 'asc' },
      take: 300,
      select: {
        id: true,
        senderId: true,
        senderName: true,
        body: true,
        imageUrl: true,
        createdAt: true,
      },
    });
  }

  async sendMessage(jobId: string, userId: string, dto: SendMessageDto) {
    await this.assertAccess(jobId, userId);

    if (!dto.body?.trim() && !dto.imageUrl) {
      throw new BadRequestException('Message must have a body or an image');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const message = await this.prisma.chatMessage.create({
      data: {
        transportJobId: jobId,
        senderId: userId,
        senderName: `${user.firstName} ${user.lastName}`,
        body: dto.body?.trim() ?? '',
        ...(dto.imageUrl ? { imageUrl: dto.imageUrl } : {}),
      },
      select: {
        id: true,
        senderId: true,
        senderName: true,
        body: true,
        imageUrl: true,
        createdAt: true,
      },
    });

    // Broadcast to all connected clients in this job's room
    this.gateway?.broadcastMessage(jobId, message);

    return message;
  }

  async getOrderMessages(orderId: string, userId: string) {
    await this.assertOrderAccess(orderId, userId);

    // Mark this chat as read for the current user
    await this.upsertLastRead(userId, { orderId });

    return this.prisma.chatMessage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      take: 300,
      select: {
        id: true,
        senderId: true,
        senderName: true,
        body: true,
        imageUrl: true,
        createdAt: true,
      },
    });
  }

  async sendOrderMessage(orderId: string, userId: string, dto: SendMessageDto) {
    await this.assertOrderAccess(orderId, userId);

    if (!dto.body?.trim() && !dto.imageUrl) {
      throw new BadRequestException('Message must have a body or an image');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const message = await this.prisma.chatMessage.create({
      data: {
        orderId,
        senderId: userId,
        senderName: `${user.firstName} ${user.lastName}`,
        body: dto.body?.trim() ?? '',
        ...(dto.imageUrl ? { imageUrl: dto.imageUrl } : {}),
      },
      select: {
        id: true,
        senderId: true,
        senderName: true,
        body: true,
        imageUrl: true,
        createdAt: true,
      },
    });

    this.gateway?.broadcastOrderMessage(orderId, message);

    return message;
  }

  /**
   * Upsert the last-read timestamp for a user in a specific chat room.
   * Called whenever a user fetches messages, so the next unread count is accurate.
   */
  private async upsertLastRead(
    userId: string,
    room: { transportJobId?: string; orderId?: string },
  ) {
    if (room.transportJobId) {
      await this.prisma.chatLastRead.upsert({
        where: { userId_transportJobId: { userId, transportJobId: room.transportJobId } },
        create: { userId, transportJobId: room.transportJobId, lastReadAt: new Date() },
        update: { lastReadAt: new Date() },
      });
    } else if (room.orderId) {
      await this.prisma.chatLastRead.upsert({
        where: { userId_orderId: { userId, orderId: room.orderId } },
        create: { userId, orderId: room.orderId, lastReadAt: new Date() },
        update: { lastReadAt: new Date() },
      });
    }
  }

  /**
   * Count chat rooms where there are messages from other users
   * sent after the current user last read that room.
   * Rooms never opened by the user (no ChatLastRead record) are counted if they
   * contain any message from someone else.
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    // Fetch all rooms the user participates in
    const rooms = await this.getMyRooms(userId);

    // Fetch all last-read records for this user in one query
    const lastReads = await this.prisma.chatLastRead.findMany({
      where: { userId },
      select: { transportJobId: true, orderId: true, lastReadAt: true },
    });

    const lastReadMap = new Map<string, Date>();
    for (const lr of lastReads) {
      const key = lr.transportJobId ?? lr.orderId ?? '';
      if (key) lastReadMap.set(key, lr.lastReadAt);
    }

    // For each room, count messages from others after lastReadAt
    const checks = rooms.map(async (room) => {
      const roomKey = 'jobId' in room ? room.jobId : ('orderId' in room ? room.orderId : null);
      if (!roomKey) return 0;

      const lastReadAt = lastReadMap.get(roomKey) ?? null;

      const count = await this.prisma.chatMessage.count({
        where: {
          ...('jobId' in room ? { transportJobId: room.jobId } : { orderId: (room as any).orderId }),
          senderId: { not: userId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });
      return count;
    });

    const counts = await Promise.all(checks);
    const total = counts.reduce((sum, c) => sum + c, 0);

    return { count: total };
  }

  /**
   * Upload a base64-encoded image to Supabase Storage and return its public URL.
   * The image is stored at chat-images/<jobId>/<timestamp>.<ext>.
   */
  async uploadChatImage(
    jobId: string,
    userId: string,
    base64: string,
    mimeType: string,
  ): Promise<{ imageUrl: string }> {
    await this.assertAccess(jobId, userId);

    if (!this.supabase) {
      throw new BadRequestException('File storage is not configured');
    }

    // Strip data URI prefix if present
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(raw, 'base64');

    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const path = `chat-images/${jobId}/${Date.now()}.${ext}`;

    await this.supabase.uploadFile('chat-images', path, buffer);
    const imageUrl = await this.supabase.createSignedUrl('chat-images', path);

    return { imageUrl };
  }
}

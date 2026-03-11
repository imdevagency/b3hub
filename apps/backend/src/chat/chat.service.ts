import { Injectable, ForbiddenException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway: ChatGateway,
  ) {}

  /** Verify the requesting user is the driver or the order creator. */
  private async assertAccess(jobId: string, userId: string) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id: jobId },
      include: { order: { select: { createdById: true } } },
    });
    if (!job) throw new NotFoundException('Transport job not found');

    const isDriver = job.driverId === userId;
    const isBuyer = job.order?.createdById === userId;

    if (!isDriver && !isBuyer) {
      throw new ForbiddenException('You are not a participant in this job');
    }

    return job;
  }

  async getMessages(jobId: string, userId: string) {
    await this.assertAccess(jobId, userId);

    return this.prisma.chatMessage.findMany({
      where: { transportJobId: jobId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderId: true,
        senderName: true,
        body: true,
        createdAt: true,
      },
    });
  }

  async sendMessage(jobId: string, userId: string, dto: SendMessageDto) {
    await this.assertAccess(jobId, userId);

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
        body: dto.body.trim(),
      },
      select: {
        id: true,
        senderId: true,
        senderName: true,
        body: true,
        createdAt: true,
      },
    });

    // Broadcast to all connected clients in this job's room
    this.gateway?.broadcastMessage(jobId, message);

    return message;
  }
}

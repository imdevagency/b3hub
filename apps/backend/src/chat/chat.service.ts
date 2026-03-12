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
      select: {
        driverId: true,
        requestedById: true,
        order: { select: { createdById: true } },
      },
    });
    if (!job) throw new NotFoundException('Transport job not found');

    const isDriver = job.driverId === userId;
    const isBuyer = job.order?.createdById === userId || job.requestedById === userId;

    if (!isDriver && !isBuyer) {
      throw new ForbiddenException('You are not a participant in this job');
    }

    return job;
  }

  async getMyRooms(userId: string) {
    const jobs = await this.prisma.transportJob.findMany({
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
        chatMessages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true, senderName: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return jobs.map((j) => ({
      jobId: j.id,
      jobNumber: j.jobNumber,
      jobType: j.jobType,
      cargoType: j.cargoType,
      pickupCity: j.pickupCity,
      deliveryCity: j.deliveryCity,
      status: j.status,
      lastMessage: j.chatMessages[0] ?? null,
    }));
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

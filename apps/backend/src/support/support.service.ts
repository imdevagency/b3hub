/**
 * Support chat service.
 * Each user has at most one support thread.
 * Users and admins can post messages. Admins can see all threads.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendSupportMessageDto } from './dto/send-support-message.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get (or create) the support thread for the requesting user. */
  async getOrCreateMyThread(userId: string, _userDisplayName: string) {
    const existing = await this.prisma.supportThread.findUnique({
      where: { userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    });

    if (existing) return existing;

    return this.prisma.supportThread.create({
      data: {
        userId,
        messages: {
          create: {
            body: `Sveiki! Kā mēs varam jums palīdzēt?`,
            senderId: userId,
            senderName: 'B3Hub atbalsts',
            fromAdmin: true,
          },
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /** Fetch messages for the user's own thread. */
  async getMyMessages(userId: string) {
    const thread = await this.prisma.supportThread.findUnique({
      where: { userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!thread) return { threadId: null, status: 'OPEN', messages: [] };

    return {
      threadId: thread.id,
      status: thread.status,
      messages: thread.messages,
    };
  }

  /** Send a message as the current user on their own thread. */
  async sendMyMessage(
    userId: string,
    senderName: string,
    dto: SendSupportMessageDto,
  ) {
    // Upsert thread then send message
    const thread = await this.prisma.supportThread.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return this.prisma.supportMessage.create({
      data: {
        threadId: thread.id,
        senderId: userId,
        senderName,
        body: dto.body,
        fromAdmin: false,
      },
    });
  }

  // ── Admin endpoints ─────────────────────────────────────────────────────

  /** Admin: list all threads, newest first. */
  async adminListThreads() {
    return this.prisma.supportThread.findMany({
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Admin: get all messages in a thread. */
  async adminGetThread(threadId: string) {
    const thread = await this.prisma.supportThread.findUnique({
      where: { id: threadId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!thread) throw new NotFoundException('Support thread not found');
    return thread;
  }

  /** Admin: reply to a thread. */
  async adminReply(
    threadId: string,
    adminUserId: string,
    adminName: string,
    dto: SendSupportMessageDto,
  ) {
    const thread = await this.prisma.supportThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) throw new NotFoundException('Support thread not found');

    return this.prisma.supportMessage.create({
      data: {
        threadId,
        senderId: adminUserId,
        senderName: adminName,
        body: dto.body,
        fromAdmin: true,
      },
    });
  }

  /** Admin: close or reopen a thread. */
  async adminSetStatus(threadId: string, status: 'OPEN' | 'CLOSED') {
    return this.prisma.supportThread.update({
      where: { id: threadId },
      data: { status },
    });
  }
}

/**
 * Chat controller — /api/v1/chat
 * REST endpoints: list conversations, fetch message history, send a message.
 * Real-time push is handled by the companion WebSocket gateway.
 */
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UploadImageDto } from './dto/upload-image.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly service: ChatService) {}

  /** GET /chat/my-rooms — list all chat rooms the user participates in */
  @Get('my-rooms')
  getMyRooms(@CurrentUser() user: RequestingUser) {
    return this.service.getMyRooms(user.userId);
  }

  /** GET /chat/unread-count — count unread chat messages across all rooms */
  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: RequestingUser) {
    return this.service.getUnreadCount(user.userId);
  }

  /** GET /chat/order/:orderId — fetch all messages for an order */
  @Get('order/:orderId')
  getOrderMessages(
    @Param('orderId') orderId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.getOrderMessages(orderId, user.userId);
  }

  /** POST /chat/order/:orderId — send a message in an order chat */
  @Post('order/:orderId')
  sendOrderMessage(
    @Param('orderId') orderId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.sendOrderMessage(orderId, user.userId, dto);
  }

  /** GET /chat/:jobId — fetch all messages for a transport job */
  @Get(':jobId')
  getMessages(
    @Param('jobId') jobId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.getMessages(jobId, user.userId);
  }

  /** POST /chat/:jobId — send a message in a transport job chat */
  @Post(':jobId')
  sendMessage(
    @Param('jobId') jobId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.sendMessage(jobId, user.userId, dto);
  }

  /** POST /chat/:jobId/upload-image — upload a photo and get back a Supabase URL */
  @Post(':jobId/upload-image')
  uploadImage(
    @Param('jobId') jobId: string,
    @Body() dto: UploadImageDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.uploadChatImage(
      jobId,
      user.userId,
      dto.base64,
      dto.mimeType,
    );
  }
}

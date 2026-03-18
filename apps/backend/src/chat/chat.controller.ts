import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly service: ChatService) {}

  /** GET /chat/my-rooms — list all chat rooms the user participates in */
  @Get('my-rooms')
  getMyRooms(@CurrentUser() user: RequestingUser) {
    return this.service.getMyRooms(user.userId);
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
}

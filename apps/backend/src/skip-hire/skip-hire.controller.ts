import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipHireService } from './skip-hire.service';
import { CreateSkipHireDto } from './dto/create-skip-hire.dto';
import { UpdateSkipHireStatusDto } from './dto/update-skip-hire-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { SkipHireStatus } from '@prisma/client';

@Controller('skip-hire')
export class SkipHireController {
  constructor(private readonly skipHireService: SkipHireService) {}

  /**
   * POST /api/v1/skip-hire
   * Public endpoint — anyone can place a skip hire order.
   * If the request carries a valid JWT the order will be linked to that user.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSkipHireDto, @Request() req: any) {
    // Attach user id if logged in (optional JWT)
    const userId: string | undefined = req.user?.userId;
    return this.skipHireService.create(dto, userId);
  }

  /**
   * GET /api/v1/skip-hire
   * Protected — admins see all orders; regular users see only their own.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req: any, @Query('status') status?: SkipHireStatus) {
    const isAdmin = req.user?.userType === 'ADMIN';
    return this.skipHireService.findAll(req.user.userId, isAdmin, status);
  }

  /**
   * GET /api/v1/skip-hire/my
   * Returns orders for the currently authenticated user.
   */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMine(@Request() req: any) {
    return this.skipHireService.findByUser(req.user.userId);
  }

  /**
   * GET /api/v1/skip-hire/number/:orderNumber
   * Lookup by the human-readable order number (e.g. SKP2602000001).
   */
  @Get('number/:orderNumber')
  findByNumber(@Param('orderNumber') orderNumber: string) {
    return this.skipHireService.findByOrderNumber(orderNumber);
  }

  /**
   * GET /api/v1/skip-hire/:id
   * Protected — must be owner or admin.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req.user?.userType === 'ADMIN';
    return this.skipHireService.findOne(id, req.user.userId, isAdmin);
  }

  /**
   * PATCH /api/v1/skip-hire/:id/status
   * Update the lifecycle status (admin only).
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSkipHireStatusDto,
  ) {
    return this.skipHireService.updateStatus(id, dto);
  }

  /**
   * POST /api/v1/skip-hire/:id/cancel
   * Owner or admin can cancel.
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id') id: string, @Request() req: any) {
    const isAdmin = req.user?.userType === 'ADMIN';
    return this.skipHireService.cancel(id, req.user.userId, isAdmin);
  }
}

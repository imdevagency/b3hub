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
   * Protected — returns all orders (admin use) or filters by status.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('status') status?: SkipHireStatus) {
    return this.skipHireService.findAll({ status });
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
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.skipHireService.findOne(id);
  }

  /**
   * PATCH /api/v1/skip-hire/:id/status
   * Update the lifecycle status (protected).
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSkipHireStatusDto,
  ) {
    return this.skipHireService.updateStatus(id, dto);
  }

  /**
   * POST /api/v1/skip-hire/:id/cancel
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id') id: string) {
    return this.skipHireService.cancel(id);
  }
}

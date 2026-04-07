/**
 * Reviews controller — /api/v1/reviews
 * Endpoints to submit a review for a completed order and list reviews for a supplier/carrier.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  /** POST /reviews — buyer submits a review for a completed order */
  @Post()
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: RequestingUser) {
    return this.service.create(dto, user.userId);
  }

  /** GET /reviews/company/:id — list all reviews for a company (public read) */
  @Get('company/:id')
  findByCompany(@Param('id') companyId: string) {
    return this.service.findByCompany(companyId);
  }

  private static readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /** GET /reviews/status — check if the user has already reviewed an order */
  @Get('status')
  status(
    @Query('orderId') orderId: string | undefined,
    @Query('skipOrderId') skipOrderId: string | undefined,
    @CurrentUser() user: RequestingUser,
  ) {
    if (orderId !== undefined && !ReviewsController.UUID_RE.test(orderId)) {
      throw new BadRequestException('orderId must be a valid UUID');
    }
    if (skipOrderId !== undefined && !ReviewsController.UUID_RE.test(skipOrderId)) {
      throw new BadRequestException('skipOrderId must be a valid UUID');
    }
    return this.service.getReviewStatus(user.userId, orderId, skipOrderId);
  }
}

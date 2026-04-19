/**
 * Weighing Slips controller — /api/v1/weighing-slips
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { WeighingSlipsService } from './weighing-slips.service';
import { CreateWeighingSlipDto } from './dto/create-weighing-slip.dto';
import { VoidWeighingSlipDto } from './dto/void-weighing-slip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Weighing Slips')
@Controller('weighing-slips')
@UseGuards(JwtAuthGuard)
export class WeighingSlipsController {
  constructor(private readonly service: WeighingSlipsService) {}

  /**
   * GET /weighing-slips?passId=xxx
   * Buyer sees weighing slips for their own passes; admins see all.
   */
  @Get()
  findByPass(
    @Query('passId') passId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!passId) throw new ForbiddenException('passId query param is required');
    const companyId =
      user.userType === 'ADMIN' ? undefined : (user.companyId ?? undefined);
    return this.service.findByPass(passId, companyId);
  }

  /**
   * POST /weighing-slips
   * Gate operator (canSell + admin, or any ADMIN) records actual weight.
   */
  @Post()
  create(
    @Body() dto: CreateWeighingSlipDto,
    @CurrentUser() user: RequestingUser,
  ) {
    // Allow: admins, or users with canSell flag (recycler/site operators)
    if (user.userType !== 'ADMIN' && !user.canSell) {
      throw new ForbiddenException(
        'Only site operators or admins can record weighing slips',
      );
    }
    return this.service.create(dto);
  }

  /**
   * PATCH /weighing-slips/:id/void — admin voids a slip (data entry error)
   */
  @Patch(':id/void')
  void(
    @Param('id') id: string,
    @Body() dto: VoidWeighingSlipDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.void(id, dto, user.userType === 'ADMIN');
  }
}

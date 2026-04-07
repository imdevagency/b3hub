import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Disputes')
@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  /** Buyer raises a dispute on a delivered order */
  @Post()
  create(@Body() dto: CreateDisputeDto, @CurrentUser() user: RequestingUser) {
    return this.disputesService.create(dto, user);
  }

  private static readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /** List disputes. Admin sees all; buyer sees own. Optional ?orderId= filter. */
  @Get()
  findAll(@Query('orderId') orderId: string | undefined, @CurrentUser() user: RequestingUser) {
    if (orderId !== undefined && !DisputesController.UUID_RE.test(orderId)) {
      throw new BadRequestException('orderId must be a valid UUID');
    }
    return this.disputesService.findAll(user, orderId);
  }

  /** Get a single dispute */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.disputesService.findOne(id, user);
  }

  /** Admin updates dispute status / resolution */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDisputeDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.disputesService.update(id, dto, user);
  }
}

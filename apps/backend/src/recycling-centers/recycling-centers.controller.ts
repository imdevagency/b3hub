import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { RecyclingCentersService } from './recycling-centers.service';
import { CreateRecyclingCenterDto } from './dto/create-recycling-center.dto';
import { UpdateRecyclingCenterDto } from './dto/update-recycling-center.dto';
import { QueryRecyclingCentersDto } from './dto/query-recycling-centers.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';

@Controller('recycling-centers')
@UseGuards(JwtAuthGuard)
export class RecyclingCentersController {
  constructor(private readonly service: RecyclingCentersService) {}

  // ── Centers ───────────────────────────────────────────────────────────────

  /** POST /recycling-centers — carrier registers a recycling center */
  @Post()
  create(
    @Body() dto: CreateRecyclingCenterDto,
    @CurrentUser() user: RequestingUser,
  ) {
    // companyId is always present for carrier accounts
    return this.service.create(dto, user.companyId!);
  }

  /** GET /recycling-centers — public list with optional filters */
  @Get()
  findAll(@Query() query: QueryRecyclingCentersDto) {
    return this.service.findAll(query);
  }

  /** GET /recycling-centers/mine — carrier's own centers */
  @Get('mine')
  findMine(@CurrentUser() user: RequestingUser) {
    return this.service.findMine(user.companyId!);
  }

  /** GET /recycling-centers/disposal/mine — buyer's disposal records */
  @Get('disposal/mine')
  getMyDisposalRecords(@CurrentUser() user: RequestingUser) {
    return this.service.getMyDisposalRecords(user.userId);
  }

  /** GET /recycling-centers/:id — center detail */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** PATCH /recycling-centers/:id — carrier updates their center */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRecyclingCenterDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.update(id, dto, user.companyId!);
  }

  /** DELETE /recycling-centers/:id — carrier deactivates their center */
  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.deactivate(id, user.companyId!);
  }

  // ── Waste Records ─────────────────────────────────────────────────────────

  /** POST /recycling-centers/:centerId/waste-records — log a waste delivery */
  @Post(':centerId/waste-records')
  createWasteRecord(
    @Param('centerId') centerId: string,
    @Body() dto: CreateWasteRecordDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.createWasteRecord(centerId, dto, user.companyId!);
  }

  /** GET /recycling-centers/:centerId/waste-records — center's intake history */
  @Get(':centerId/waste-records')
  getWasteRecords(
    @Param('centerId') centerId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.getWasteRecords(centerId, user.companyId!);
  }

  /** PATCH /recycling-centers/:centerId/waste-records/:recordId — update processing / add certificate */
  @Patch(':centerId/waste-records/:recordId')
  updateWasteRecord(
    @Param('centerId') centerId: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateWasteRecordDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.updateWasteRecord(
      centerId,
      recordId,
      dto,
      user.companyId!,
    );
  }
}

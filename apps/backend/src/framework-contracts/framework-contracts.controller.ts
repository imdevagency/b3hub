import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FrameworkContractsService } from './framework-contracts.service';
import { CreateFrameworkContractDto } from './dto/create-contract.dto';
import { CreatePositionDto } from './dto/add-position.dto';
import { UpdateFrameworkContractDto } from './dto/update-contract.dto';
import { CreateCallOffDto } from './dto/create-calloff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('framework-contracts')
@UseGuards(JwtAuthGuard)
export class FrameworkContractsController {
  constructor(private readonly service: FrameworkContractsService) {}

  /** GET /framework-contracts — list my contracts */
  @Get()
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.userId, user.companyId);
  }

  /** GET /framework-contracts/:id — contract detail */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.userId, user.companyId);
  }

  /** POST /framework-contracts — create contract (with optional initial positions) */
  @Post()
  create(@Body() dto: CreateFrameworkContractDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.userId, user.companyId);
  }

  /** PATCH /framework-contracts/:id — update title / dates / status */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFrameworkContractDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user.userId, user.companyId);
  }

  /** POST /framework-contracts/:id/positions — add a position */
  @Post(':id/positions')
  addPosition(
    @Param('id') id: string,
    @Body() dto: CreatePositionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addPosition(id, dto, user.userId, user.companyId);
  }

  /** DELETE /framework-contracts/:id/positions/:posId — remove a position */
  @Delete(':id/positions/:posId')
  removePosition(
    @Param('id') id: string,
    @Param('posId') posId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.removePosition(id, posId, user.userId, user.companyId);
  }

  /** POST /framework-contracts/:id/positions/:posId/call-off — release a transport job */
  @Post(':id/positions/:posId/call-off')
  createCallOff(
    @Param('id') id: string,
    @Param('posId') posId: string,
    @Body() dto: CreateCallOffDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createCallOff(id, posId, dto, user.userId, user.companyId);
  }
}

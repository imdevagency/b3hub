import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FrameworkContractsService } from './framework-contracts.service';
import { CreateFrameworkContractDto } from './dto/create-contract.dto';
import { CreatePositionDto } from './dto/add-position.dto';
import { UpdateFrameworkContractDto } from './dto/update-contract.dto';
import { CreateCallOffDto } from './dto/create-calloff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

/** Returns true if the user has full access (OWNER or solo account) */
function isOwnerOrSolo(user: RequestingUser): boolean {
  return !user.companyId || user.companyRole === 'OWNER';
}

@Controller('framework-contracts')
@UseGuards(JwtAuthGuard)
export class FrameworkContractsController {
  constructor(private readonly service: FrameworkContractsService) {}

  /** GET /framework-contracts — list my contracts */
  @Get()
  findAll(@CurrentUser() user: RequestingUser) {
    return this.service.findAll(user.userId, user.companyId);
  }

  /** GET /framework-contracts/:id — contract detail */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.findOne(id, user.userId, user.companyId);
  }

  /** POST /framework-contracts — create contract (OWNER or permCreateContracts) */
  @Post()
  create(@Body() dto: CreateFrameworkContractDto, @CurrentUser() user: RequestingUser) {
    if (!isOwnerOrSolo(user) && !user.permCreateContracts) {
      throw new ForbiddenException('You do not have permission to create framework contracts');
    }
    return this.service.create(dto, user.userId, user.companyId);
  }

  /** PATCH /framework-contracts/:id — update (OWNER or permCreateContracts) */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFrameworkContractDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrSolo(user) && !user.permCreateContracts) {
      throw new ForbiddenException('You do not have permission to update framework contracts');
    }
    return this.service.update(id, dto, user.userId, user.companyId);
  }

  /** POST /framework-contracts/:id/positions — add a position (OWNER or permCreateContracts) */
  @Post(':id/positions')
  addPosition(
    @Param('id') id: string,
    @Body() dto: CreatePositionDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrSolo(user) && !user.permCreateContracts) {
      throw new ForbiddenException('You do not have permission to manage contract positions');
    }
    return this.service.addPosition(id, dto, user.userId, user.companyId);
  }

  /** DELETE /framework-contracts/:id/positions/:posId — remove a position (OWNER or permCreateContracts) */
  @Delete(':id/positions/:posId')
  removePosition(
    @Param('id') id: string,
    @Param('posId') posId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrSolo(user) && !user.permCreateContracts) {
      throw new ForbiddenException('You do not have permission to manage contract positions');
    }
    return this.service.removePosition(id, posId, user.userId, user.companyId);
  }

  /** POST /framework-contracts/:id/positions/:posId/call-off — release a transport job (OWNER or permReleaseCallOffs) */
  @Post(':id/positions/:posId/call-off')
  createCallOff(
    @Param('id') id: string,
    @Param('posId') posId: string,
    @Body() dto: CreateCallOffDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrSolo(user) && !user.permReleaseCallOffs) {
      throw new ForbiddenException('You do not have permission to release call-offs');
    }
    return this.service.createCallOff(id, posId, dto, user.userId, user.companyId);
  }
}

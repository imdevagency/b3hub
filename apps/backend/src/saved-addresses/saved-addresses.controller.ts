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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { SavedAddressesService } from './saved-addresses.service';
import { CreateSavedAddressDto } from './dto/create-saved-address.dto';
import { UpdateSavedAddressDto } from './dto/update-saved-address.dto';

@UseGuards(JwtAuthGuard)
@Controller('saved-addresses')
export class SavedAddressesController {
  constructor(private readonly service: SavedAddressesService) {}

  @Get()
  findAll(@CurrentUser() user: RequestingUser) {
    return this.service.findAll(user);
  }

  @Post()
  create(
    @Body() dto: CreateSavedAddressDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSavedAddressDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.remove(id, user);
  }

  @Patch(':id/set-default')
  setDefault(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.setDefault(id, user);
  }
}

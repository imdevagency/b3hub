import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

@ApiTags('Payment Methods')
@UseGuards(JwtAuthGuard)
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestingUser) {
    return this.service.findAll(user);
  }

  @Post()
  create(
    @Body() dto: CreatePaymentMethodDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.create(dto, user);
  }

  @Patch(':id/set-default')
  setDefault(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.setDefault(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.remove(id, user);
  }
}

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  /** List all active API keys for the caller's company (key hashes never returned). */
  @Get()
  list(@CurrentUser() user: RequestingUser) {
    return this.apiKeysService.list(user);
  }

  /**
   * Create a new API key.
   * The full plaintext key is returned ONCE in the response — it cannot be retrieved again.
   */
  @Post()
  create(@CurrentUser() user: RequestingUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(user, dto);
  }

  /** Revoke (soft-delete) an API key by ID. */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  revoke(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    return this.apiKeysService.revoke(user, id);
  }
}

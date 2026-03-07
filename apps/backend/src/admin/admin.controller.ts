import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  /** GET /admin/stats — overview counters */
  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  /** GET /admin/users — all users list */
  @Get('users')
  getUsers() {
    return this.service.getUsers();
  }

  /** PATCH /admin/users/:id — toggle flags / status */
  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body()
    body: {
      canSell?: boolean;
      canTransport?: boolean;
      canSkipHire?: boolean;
      status?: string;
      userType?: string;
    },
  ) {
    return this.service.updateUser(id, body);
  }
}

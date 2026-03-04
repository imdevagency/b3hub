import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { TransportJobsService } from './transport-jobs.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('transport-jobs')
@UseGuards(JwtAuthGuard)
export class TransportJobsController {
  constructor(private readonly service: TransportJobsService) {}

  /**
   * GET /transport-jobs
   * Returns all AVAILABLE jobs for the job board.
   */
  @Get()
  findAvailable() {
    return this.service.findAvailable();
  }

  /**
   * GET /transport-jobs/my-active
   * Returns the logged-in driver's current in-progress job (or null).
   */
  @Get('my-active')
  findMyActiveJob(@CurrentUser() user: any) {
    return this.service.findMyActiveJob(user.id);
  }

  /**
   * GET /transport-jobs/my-jobs
   * Returns all jobs ever assigned to the logged-in driver.
   */
  @Get('my-jobs')
  findMyJobs(@CurrentUser() user: any) {
    return this.service.findMyJobs(user.id);
  }

  /**
   * GET /transport-jobs/:id
   * Returns a single job by ID.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /**
   * POST /transport-jobs/:id/accept
   * Driver accepts an available job.
   */
  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.accept(id, user.id);
  }

  /**
   * PATCH /transport-jobs/:id/status
   * Driver advances their active job to the next status.
   */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.service.updateStatus(id, user.id, dto);
  }
}

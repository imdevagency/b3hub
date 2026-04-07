/**
 * Transport jobs controller — /api/v1/transport-jobs
 * Endpoints: create job, list available/my jobs, accept, update location,
 * upload delivery proof, complete job.
 */
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransportJobsService } from './transport-jobs.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateTransportJobDto } from './dto/create-transport-job.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { SubmitDeliveryProofDto } from './dto/submit-delivery-proof.dto';
import {
  AssignDispatchDto,
  UnassignDispatchDto,
} from './dto/assign-dispatch.dto';
import {
  ReportTransportExceptionDto,
  ResolveTransportExceptionDto,
} from './dto/report-exception.dto';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { ReviewsService } from '../reviews/reviews.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SurchargeType } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

class CreateDriverReviewDto {
  @IsInt() @Min(1) @Max(5) @Type(() => Number) rating: number;
  @IsString() @IsOptional() comment?: string;
}

class CreateTransportSurchargeDto {
  @IsEnum(SurchargeType) type: SurchargeType;
  @IsNumber() @Min(0) @Type(() => Number) amount: number;
  @IsString() @IsOptional() label?: string;
  @IsBoolean() @IsOptional() billable?: boolean;
}

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

class UploadPickupPhotoDto {
  @IsString()
  @IsNotEmpty()
  base64: string;

  @IsOptional()
  @IsIn(ALLOWED_PHOTO_TYPES)
  mimeType?: string;
}

function canDispatch(user: RequestingUser): boolean {
  return (
    user.userType === 'ADMIN' ||
    user.companyRole === 'OWNER' ||
    user.companyRole === 'MANAGER' ||
    !!user.permManageOrders ||
    // Allow canTransport company users who have no companyRole yet
    // (e.g. first company account before member roles are assigned).
    // Explicitly exclude DRIVER and MEMBER — they are field workers, not dispatchers.
    (user.canTransport && user.isCompany && !user.companyRole)
  );
}

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Transport Jobs')
@Controller('transport-jobs')
@UseGuards(JwtAuthGuard)
export class TransportJobsController {
  constructor(
    private readonly service: TransportJobsService,
    private readonly reviewsService: ReviewsService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * POST /transport-jobs
   * Dispatcher / admin creates a new transport job and posts it to the board.
   */
  @Post()
  create(
    @Body() dto: CreateTransportJobDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!canDispatch(user)) {
      throw new ForbiddenException(
        'You do not have permission to create transport jobs',
      );
    }
    return this.service.createAsUser(dto, user);
  }

  /**
   * GET /transport-jobs
   * Returns all AVAILABLE jobs for the job board with pagination.
   */
  @Get()
  findAvailable(@Query() pagination: PaginationDto) {
    return this.service.findAvailable(pagination.limit ?? 20, pagination.skip ?? 0);
  }

  /**
   * GET /transport-jobs/my-active
   * Returns the logged-in driver's current in-progress job (or null).
   */
  @Get('my-active')
  findMyActiveJob(@CurrentUser() user: RequestingUser) {
    return this.service.findMyActiveJob(user.userId);
  }

  /**
   * GET /transport-jobs/my-jobs
   * Returns all jobs ever assigned to the logged-in driver with pagination.
   */
  @Get('my-jobs')
  findMyJobs(
    @CurrentUser() user: RequestingUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMyJobs(user.userId, pagination.limit ?? 20, pagination.skip ?? 0);
  }

  /**
   * GET /transport-jobs/my-requests
   * Returns all disposal / freight jobs requested by the current user (buyer role) with pagination.
   */
  @Get('my-requests')
  findMyRequests(
    @CurrentUser() user: RequestingUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMyRequests(user.userId, pagination.limit ?? 20, pagination.skip ?? 0);
  }

  /**
   * GET /transport-jobs/return-trips?lat=&lng=&radiusKm=
   * Avoid Empty Runs — returns AVAILABLE jobs whose pickup is near the given coords.
   * Typically called with the driver's current delivery destination coordinates.
   */
  @Get('return-trips')
  findReturnTrips(
    @CurrentUser() user: RequestingUser,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    if (!user.canTransport) {
      throw new ForbiddenException('Only approved drivers can query return trips');
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      throw new BadRequestException('lat must be a number between -90 and 90');
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      throw new BadRequestException('lng must be a number between -180 and 180');
    }
    const radiusNum = radiusKm ? parseFloat(radiusKm) : 50;
    const clampedRadius = Math.min(Math.max(Number.isFinite(radiusNum) ? radiusNum : 50, 1), 500);
    return this.service.findReturnTrips(latNum, lngNum, clampedRadius);
  }

  /**
   * GET /transport-jobs/fleet
   * Returns ALL jobs for the dispatcher fleet status board.
   * Must come before :id route to avoid NestJS matching 'fleet' as an ID.
   */
  @Get('fleet')
  findAll(@CurrentUser() user: RequestingUser) {
    if (!canDispatch(user)) {
      throw new ForbiddenException(
        'You do not have permission to view fleet jobs',
      );
    }
    return this.service.findAllAsUser(user);
  }

  /**
   * GET /transport-jobs/:id
   * Returns a single job by ID.
   */
  @Get('drivers')
  findDrivers(@CurrentUser() user: RequestingUser) {
    if (!canDispatch(user)) {
      throw new ForbiddenException(
        'You do not have permission to view drivers',
      );
    }
    return this.service.findDriversAsUser(user);
  }

  /**
   * GET /transport-jobs/sla-overdue
   * Dispatcher list of currently overdue jobs.
   */
  @Get('sla-overdue')
  findSlaOverdue(@CurrentUser() user: RequestingUser) {
    if (!canDispatch(user)) {
      throw new ForbiddenException(
        'You do not have permission to view SLA overdues',
      );
    }
    return this.service.findSlaOverdue();
  }

  /**
   * GET /transport-jobs/exceptions/open
   * Dispatcher list of currently open transport exceptions.
   */
  @Get('exceptions/open')
  findOpenExceptions(@CurrentUser() user: RequestingUser) {
    if (!canDispatch(user)) {
      throw new ForbiddenException(
        'You do not have permission to view open transport exceptions',
      );
    }
    return this.service.findOpenExceptions();
  }

  /**
   * GET /transport-jobs/:id/document-readiness
   * Returns required document gate state before completion.
   * Ownership enforced via findOneAsUser.
   */
  @Get(':id/document-readiness')
  async getDocumentReadiness(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    // Validates ownership/access — throws 403/404 if caller has no access to this job.
    await this.service.findOneAsUser(id, user);
    return this.service.getDocumentReadiness(id);
  }

  /**
   * GET /transport-jobs/:id
   * Returns a single job by ID.
   */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.findOneAsUser(id, user);
  }

  /**
   * POST /transport-jobs/:id/accept
   * Driver accepts an available job.
   */
  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    if (!user.canTransport) {
      throw new ForbiddenException('Only approved drivers can accept transport jobs');
    }
    return this.service.accept(id, user.userId);
  }

  /**
   * POST /transport-jobs/:id/decline-offer
   * Driver declines the exclusive job offer and adds themselves to the declined list.
   * The auto-dispatch cron will immediately offer the job to the next eligible driver.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/decline-offer')
  declineOffer(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    if (!user.canTransport) {
      throw new ForbiddenException('Only approved drivers can decline job offers');
    }
    return this.service.declineOffer(id, user.userId);
  }

  /**
   * PATCH /transport-jobs/:id/assign
   * Dispatcher assigns a vehicle + driver to an available job.
   */
  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: AssignDispatchDto,
  ) {
    if (!canDispatch(user)) {
      throw new ForbiddenException(
        'You do not have permission to assign transport jobs',
      );
    }
    return this.service.assign(id, body);
  }

  /**
   * PATCH /transport-jobs/:id/reassign
   * Dispatcher reassigns a pre-dispatch job to another driver/vehicle.
   */
  @Patch(':id/reassign')
  reassign(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: AssignDispatchDto,
  ) {
    if (!canDispatch(user)) {
      throw new ForbiddenException(
        'You do not have permission to reassign transport jobs',
      );
    }
    return this.service.reassign(id, body);
  }

  /**
   * PATCH /transport-jobs/:id/force-reassign
   * Admin-only: forcibly reassign a job that is stuck mid-route (any active status).
   * Used when a driver breaks down, goes unresponsive, or has an emergency.
   * Automatically logs a RESOLVED exception for traceability.
   */
  @Patch(':id/force-reassign')
  forceReassign(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: AssignDispatchDto & { note?: string },
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException(
        'Only admins can force-reassign in-progress jobs',
      );
    }
    return this.service.forceReassign(id, body, user.userId);
  }

  /**
   * PATCH /transport-jobs/:id/unassign
   * Dispatcher unassigns a job and returns it to AVAILABLE.
   */
  @Patch(':id/unassign')
  unassign(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: UnassignDispatchDto,
  ) {
    if (!canDispatch(user)) {
      throw new ForbiddenException(
        'You do not have permission to unassign transport jobs',
      );
    }
    return this.service.unassign(id, body.reason);
  }

  /**
   * PATCH /transport-jobs/:id/status
   * Driver advances their active job to the next status.
   */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.service.updateStatus(id, user.userId, dto);
  }

  /**
   * PATCH /transport-jobs/:id/location
   * Driver pushes their current GPS coordinates.
   */
  @Patch(':id/location')
  updateLocation(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.service.updateLocation(id, user.userId, dto);
  }

  /**
   * GET /transport-jobs/:id/location
   * Buyer polls this endpoint for live truck position.
   */
  @Get(':id/location')
  getLocation(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.getLocationAsUser(id, user);
  }

  /**
   * POST /transport-jobs/:id/delivery-proof
   * Driver submits proof of delivery — job transitions to DELIVERED.
   */
  @Post(':id/delivery-proof')
  submitDeliveryProof(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() dto: SubmitDeliveryProofDto,
  ) {
    return this.service.submitDeliveryProof(id, user.userId, dto);
  }

  /**
   * POST /transport-jobs/:id/pickup-photo
   * Driver uploads a pickup/loading photo as base64.
   * Returns a Supabase Storage URL to be passed into the LOADED status update.
   */
  @Post(':id/pickup-photo')
  async uploadPickupPhoto(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() dto: UploadPickupPhotoDto,
  ) {
    if (!user.canTransport) {
      throw new ForbiddenException('Only drivers can upload pickup photos');
    }
    if (!this.supabase) {
      throw new BadRequestException('File storage is not configured');
    }
    const mimeType = dto.mimeType ?? 'image/jpeg';
    const raw = dto.base64.includes(',') ? dto.base64.split(',')[1] : dto.base64;
    const buffer = Buffer.from(raw, 'base64');
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const path = `pickup-photos/${id}/${Date.now()}.${ext}`;
    await this.supabase.uploadFile('pickup-photos', path, buffer);
    const url = await this.supabase.createSignedUrl('pickup-photos', path);
    return { url };
  }

  /**
   * POST /transport-jobs/:id/loading-dock
   * Seller confirms driver has loaded cargo at pickup yard.
   * Transitions AT_PICKUP → LOADED and auto-generates a WEIGHING_SLIP document.
   * Body: { weightKg?: number }
   */
  @Post(':id/loading-dock')
  loadingDock(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: { weightKg?: number },
  ) {
    return this.service.loadingDockAsUser(id, user, body.weightKg);
  }

  /**
   * GET /transport-jobs/:id/exceptions
   * List all exceptions for a job.
   */
  @Get(':id/exceptions')
  listExceptions(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.listExceptions(id, user);
  }

  /**
   * POST /transport-jobs/:id/exceptions
   * Report operational exception (no-show, wrong material, partial delivery, etc.).
   */
  @Post(':id/exceptions')
  reportException(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() dto: ReportTransportExceptionDto,
  ) {
    return this.service.reportException(id, user, dto);
  }

  /**
   * PATCH /transport-jobs/:id/exceptions/:exceptionId/resolve
   * Dispatcher/admin resolves an open transport exception.
   */
  @Patch(':id/exceptions/:exceptionId/resolve')
  resolveException(
    @Param('id') id: string,
    @Param('exceptionId') exceptionId: string,
    @CurrentUser() user: RequestingUser,
    @Body() dto: ResolveTransportExceptionDto,
  ) {
    if (!canDispatch(user)) {
      throw new ForbiddenException(
        'You do not have permission to resolve transport exceptions',
      );
    }
    return this.service.resolveException(id, exceptionId, user.userId, dto);
  }

  /**
   * POST /transport-jobs/:id/review
   * Buyer rates the driver after a job is DELIVERED (1-5 stars + optional comment).
   * One review per transport job — 409 if already rated.
   */
  @Post(':id/review')
  reviewDriver(
    @Param('id') id: string,
    @Body() dto: CreateDriverReviewDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.reviewsService.createDriverReview(id, dto, user.userId);
  }

  /**
   * POST /transport-jobs/:id/surcharges
   * The assigned driver adds a surcharge (fuel, waiting time, overweight, etc.)
   * to the order linked to this transport job.
   */
  @Post(':id/surcharges')
  addSurcharge(
    @Param('id') id: string,
    @Body() dto: CreateTransportSurchargeDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.addSurcharge(id, dto, user.userId);
  }
}

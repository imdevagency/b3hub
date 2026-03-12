import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TransportJobsService } from './transport-jobs.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateTransportJobDto } from './dto/create-transport-job.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { SubmitDeliveryProofDto } from './dto/submit-delivery-proof.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('transport-jobs')
@UseGuards(JwtAuthGuard)
export class TransportJobsController {
  constructor(private readonly service: TransportJobsService) {}

  /**
   * POST /transport-jobs
   * Dispatcher / admin creates a new transport job and posts it to the board.
   */
  @Post()
  create(@Body() dto: CreateTransportJobDto) {
    return this.service.create(dto);
  }

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
   * GET /transport-jobs/my-requests
   * Returns all disposal / freight jobs requested by the current user (buyer role).
   */
  @Get('my-requests')
  findMyRequests(@CurrentUser() user: any) {
    return this.service.findMyRequests(user.userId);
  }

  /**
   * GET /transport-jobs/return-trips?lat=&lng=&radiusKm=
   * Avoid Empty Runs — returns AVAILABLE jobs whose pickup is near the given coords.
   * Typically called with the driver's current delivery destination coordinates.
   */
  @Get('return-trips')
  findReturnTrips(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.service.findReturnTrips(
      parseFloat(lat),
      parseFloat(lng),
      radiusKm ? parseFloat(radiusKm) : 50,
    );
  }

  /**
   * GET /transport-jobs/fleet
   * Returns ALL jobs for the dispatcher fleet status board.
   * Must come before :id route to avoid NestJS matching 'fleet' as an ID.
   */
  @Get('fleet')
  findAll() {
    return this.service.findAll();
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
   * GET /transport-jobs/drivers
   * Returns all users with canTransport=true for the dispatcher dropdown.
   */
  @Get('drivers')
  findDrivers() {
    return this.service.findDrivers();
  }

  /**
   * PATCH /transport-jobs/:id/assign
   * Dispatcher assigns a vehicle + driver to an available job.
   */
  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() body: { driverId: string; vehicleId: string },
  ) {
    return this.service.assign(id, body);
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

  /**
   * PATCH /transport-jobs/:id/location
   * Driver pushes their current GPS coordinates.
   */
  @Patch(':id/location')
  updateLocation(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.service.updateLocation(id, user.id, dto);
  }

  /**
   * GET /transport-jobs/:id/location
   * Buyer polls this endpoint for live truck position.
   */
  @Get(':id/location')
  getLocation(@Param('id') id: string) {
    return this.service.getLocation(id);
  }

  /**
   * POST /transport-jobs/:id/delivery-proof
   * Driver submits proof of delivery — job transitions to DELIVERED.
   */
  @Post(':id/delivery-proof')
  submitDeliveryProof(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: SubmitDeliveryProofDto,
  ) {
    return this.service.submitDeliveryProof(id, user.id, dto);
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
    @Body() body: { weightKg?: number },
  ) {
    return this.service.loadingDock(id, body.weightKg);
  }
}

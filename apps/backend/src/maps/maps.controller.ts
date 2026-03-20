import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { MapsService } from './maps.service';
import { RoutePolylineDto } from './dto/route-polyline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('maps')
@UseGuards(JwtAuthGuard)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Post('route-polyline')
  async routePolyline(@Body() dto: RoutePolylineDto) {
    const encodedPolyline = await this.mapsService.getRouteEncodedPolyline(dto);
    return { encodedPolyline };
  }
}

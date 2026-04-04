import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { MapsService } from './maps.service';
import { RoutePolylineDto } from './dto/route-polyline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Maps')
@Controller('maps')
@UseGuards(JwtAuthGuard)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Post('route-polyline')
  async routePolyline(@Body() dto: RoutePolylineDto) {
    const encodedPolyline = await this.mapsService.getRouteEncodedPolyline(dto);
    return { encodedPolyline };
  }

  /** GET /maps/autocomplete?input=Riga */
  @Get('autocomplete')
  async autocomplete(@Query('input') input: string) {
    const suggestions = await this.mapsService.autocomplete(input ?? '');
    return { suggestions };
  }

  /** GET /maps/place-details?place_id=ChIJ... */
  @Get('place-details')
  async placeDetails(@Query('place_id') placeId: string) {
    const location = await this.mapsService.placeDetails(placeId ?? '');
    return { location };
  }

  /** GET /maps/reverse-geocode?lat=56.9496&lng=24.1052 */
  @Get('reverse-geocode')
  async reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    const address = await this.mapsService.reverseGeocode(parseFloat(lat), parseFloat(lng));
    return { address };
  }
}

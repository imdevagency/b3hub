import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
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
    // Truncate to 200 chars to prevent excessively large upstream requests
    const sanitized = (input ?? '').slice(0, 200).trim();
    const suggestions = await this.mapsService.autocomplete(sanitized);
    return { suggestions };
  }

  /** GET /maps/place-details?place_id=ChIJ... */
  @Get('place-details')
  async placeDetails(@Query('place_id') placeId: string) {
    if (!placeId || placeId.length > 500) {
      throw new BadRequestException('Invalid place_id');
    }
    // place_id only contains alphanumeric chars and certain symbols — strip anything else
    const sanitized = placeId.replace(/[^A-Za-z0-9_\-+]/g, '');
    const location = await this.mapsService.placeDetails(sanitized);
    return { location };
  }

  /** GET /maps/reverse-geocode?lat=56.9496&lng=24.1052 */
  @Get('reverse-geocode')
  async reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      throw new BadRequestException('lat must be a number between -90 and 90');
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      throw new BadRequestException(
        'lng must be a number between -180 and 180',
      );
    }
    const address = await this.mapsService.reverseGeocode(latNum, lngNum);
    return { address };
  }
}

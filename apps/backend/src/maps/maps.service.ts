import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);

  constructor(private readonly configService: ConfigService) {}

  async getRouteEncodedPolyline(input: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
  }): Promise<string | null> {
    const apiKey = this.configService
      .get<string>('GOOGLE_MAPS_SERVER_API_KEY')
      ?.trim();
    if (!apiKey) {
      this.logger.warn('GOOGLE_MAPS_SERVER_API_KEY is not configured');
      return null;
    }

    const res = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: input.originLat,
                longitude: input.originLng,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: input.destLat,
                longitude: input.destLng,
              },
            },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
        }),
      },
    );

    if (!res.ok) {
      this.logger.warn(`Google Routes API failed with status ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      routes?: Array<{ polyline?: { encodedPolyline?: string } }>;
    };
    return data.routes?.[0]?.polyline?.encodedPolyline ?? null;
  }
}

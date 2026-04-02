import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlaceSuggestion {
  place_id: string;
  description: string;
}

export interface PlaceLatLng {
  lat: number;
  lng: number;
}

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);

  constructor(private readonly configService: ConfigService) {}

  private getApiKey(): string {
    const key = this.configService.get<string>('GOOGLE_MAPS_SERVER_API_KEY')?.trim() ?? '';
    if (!key) this.logger.warn('GOOGLE_MAPS_SERVER_API_KEY is not configured');
    return key;
  }

  async getRouteEncodedPolyline(input: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
  }): Promise<string | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

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

  /** Proxy Google Places Autocomplete — keeps API key server-side. */
  async autocomplete(input: string): Promise<PlaceSuggestion[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}` +
        `&language=lv&region=lv&location=56.9496,24.1052&radius=120000` +
        `&components=country:lv|country:lt|country:ee` +
        `&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json() as { predictions?: PlaceSuggestion[] };
      return (data.predictions ?? []).slice(0, 8);
    } catch (e) {
      this.logger.warn('Places autocomplete failed', e);
      return [];
    }
  }

  /** Proxy Google Place Details to get lat/lng from place_id. */
  async placeDetails(placeId: string): Promise<PlaceLatLng | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=geometry` +
        `&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json() as {
        result?: { geometry?: { location?: PlaceLatLng } };
      };
      return data.result?.geometry?.location ?? null;
    } catch (e) {
      this.logger.warn('Place details failed', e);
      return null;
    }
  }

  /** Proxy Google Geocoding API — reverse geocode (lat/lng → address string). */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${lat},${lng}` +
        `&language=lv` +
        `&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const data = await res.json() as { results?: Array<{ formatted_address: string }> };
      return data.results?.[0]?.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (e) {
      this.logger.warn('Reverse geocode failed', e);
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }
}

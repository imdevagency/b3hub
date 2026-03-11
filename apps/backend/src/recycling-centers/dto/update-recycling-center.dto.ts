import { WasteType } from '@prisma/client';

export class UpdateRecyclingCenterDto {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  coordinates?: { lat: number; lng: number } | null;
  acceptedWasteTypes?: WasteType[];
  capacity?: number;
  certifications?: string[];
  operatingHours?: Record<string, { open: string; close: string } | null>;
  active?: boolean;
}

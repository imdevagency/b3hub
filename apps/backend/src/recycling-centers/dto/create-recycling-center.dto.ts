import { WasteType } from '@prisma/client';

export class CreateRecyclingCenterDto {
  name!: string;

  // Location
  address!: string;
  city!: string;
  state!: string;
  postalCode!: string;
  coordinates?: { lat: number; lng: number };

  // Capabilities
  acceptedWasteTypes!: WasteType[];
  capacity!: number; // tonnes per day
  certifications?: string[];

  // Operating hours: {monday: {open: '08:00', close: '17:00'}, ...}
  operatingHours!: Record<string, { open: string; close: string } | null>;
}

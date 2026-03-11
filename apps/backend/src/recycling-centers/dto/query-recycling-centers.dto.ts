import { WasteType } from '@prisma/client';

export class QueryRecyclingCentersDto {
  city?: string;
  wasteType?: WasteType;
  activeOnly?: boolean; // default true
  page?: number;
  limit?: number;
}

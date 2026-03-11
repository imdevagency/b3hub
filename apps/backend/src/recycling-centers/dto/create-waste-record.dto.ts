import { WasteType } from '@prisma/client';

export class CreateWasteRecordDto {
  // Optional link to a container order
  containerOrderId?: string;

  // Waste details
  wasteType!: WasteType;
  weight!: number;   // tonnes
  volume?: number;   // m³

  // Processing results (can be filled in later via PATCH)
  processedDate?: string; // ISO date string
  recyclableWeight?: number;
  recyclingRate?: number; // 0-100 %

  // Output
  producedMaterialId?: string;

  // Compliance
  certificateUrl?: string;
}

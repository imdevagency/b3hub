const fs = require('fs');
const file = 'apps/web/src/lib/api/orders.ts';
let content = fs.readFileSync(file, 'utf8');

const newCode = `
export type WasteType = 'CONCRETE' | 'BRICK' | 'WOOD' | 'METAL' | 'PLASTIC' | 'SOIL' | 'MIXED' | 'HAZARDOUS';
export type DisposalTruckType = 'TIPPER_SMALL' | 'TIPPER_LARGE' | 'ARTICULATED_TIPPER';
export type TransportVehicleType = 'TIPPER_SMALL' | 'TIPPER_LARGE' | 'ARTICULATED_TIPPER';

export interface CreateDisposalOrderInput {
  pickupAddress: string;
  pickupCity: string;
  pickupLat?: number;
  pickupLng?: number;
  wasteType: WasteType;
  truckType: DisposalTruckType;
  truckCount: number;
  estimatedWeight: number;
  description?: string;
  requestedDate: string;
  siteContactName?: string;
  siteContactPhone?: string;
  notes?: string;
}

export interface CreateTransportOrderInput {
  pickupAddress: string;
  pickupCity: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress: string;
  dropoffCity: string;
  dropoffLat?: number;
  dropoffLng?: number;
  vehicleType: TransportVehicleType;
  loadDescription: string;
  estimatedWeight?: number;
  requestedDate: string;
  siteContactName?: string;
  siteContactPhone?: string;
  notes?: string;
}

export interface CreateOrderResponse {
  id: string;
  jobNumber?: string;
  orderNumber?: string;
}

export async function createDisposalOrder(input: CreateDisposalOrderInput, token: string): Promise<CreateOrderResponse> {
  return apiFetch('/orders/disposal', {
    method: 'POST',
    headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function createTransportOrder(input: CreateTransportOrderInput, token: string): Promise<CreateOrderResponse> {
  return apiFetch('/orders/freight', {
    method: 'POST',
    headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
`;

if (!content.includes('createDisposalOrder')) {
  fs.writeFileSync(file, content + '\n' + newCode);
  console.log('Added api methods');
} else {
  console.log('Already exists');
}

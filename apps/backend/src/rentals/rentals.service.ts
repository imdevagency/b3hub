import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RentalOrderStatus, RentalServiceType, Prisma } from '@prisma/client';
import { CreateRentalOrderDto } from './dto/create-rental-order.dto';
import { CreateRentalListingDto } from './dto/create-rental-listing.dto';
import { UpdateRentalListingDto } from './dto/update-rental-listing.dto';
import { SERVICES_WITHOUT_IN_USE, RENTAL_STATUS_FLOW } from './rental.types';
import { randomBytes } from 'crypto';

@Injectable()
export class RentalsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateRentalOrderDto, userId?: string) {
    let resolvedServiceType = dto.serviceType;
    let resolvedProviderId: string | undefined;

    // Listing-based order — resolve serviceType and provider from the listing
    if (dto.listingId) {
      const listing = await this.prisma.rentalListing.findUnique({
        where: { id: dto.listingId },
        select: { serviceType: true, providerId: true, isActive: true },
      });
      if (!listing || !listing.isActive) {
        throw new BadRequestException('Listing not found or no longer available');
      }
      resolvedServiceType = listing.serviceType;
      resolvedProviderId = listing.providerId;
    }

    const orderNumber = await this.generateOrderNumber(resolvedServiceType);
    const trackingToken = randomBytes(16).toString('hex');

    return this.prisma.rentalOrder.create({
      data: {
        orderNumber,
        serviceType: resolvedServiceType,
        listingId: dto.listingId ?? null,
        providerId: resolvedProviderId ?? null,
        address: dto.address,
        city: dto.city,
        lat: dto.lat,
        lng: dto.lng,
        hireDays: dto.hireDays,
        deliveryDate: new Date(dto.deliveryDate),
        deliveryWindow: dto.deliveryWindow ?? 'ANY',
        quantity: dto.quantity,
        price: dto.price,
        paymentMethod: dto.paymentMethod ?? 'CARD',
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        notes: dto.notes,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        // Add-ons & insurance
        selectedAddOns: dto.selectedAddOns
          ? (dto.selectedAddOns as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        insurancePlanId: dto.insurancePlanId ?? null,
        insurancePlanName: dto.insurancePlanName ?? null,
        insurancePricePerDay: dto.insurancePricePerDay ?? null,
        // Pricing breakdown
        deliveryFee: dto.deliveryFee ?? null,
        depositAmount: dto.depositAmount ?? null,
        userId: userId ?? null,
        trackingToken,
        statusTimestamps: { PENDING: new Date().toISOString() },
      },
    });
  }

  // ── Find all (for carrier) ──────────────────────────────────────────────────

  async findCarrierOrders(carrierId: string, serviceType?: RentalServiceType) {
    return this.prisma.rentalOrder.findMany({
      where: {
        carrierId,
        ...(serviceType ? { serviceType } : {}),
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      orderBy: { deliveryDate: 'asc' },
    });
  }

  // ── Find all (for buyer) ────────────────────────────────────────────────────

  async findBuyerOrders(userId: string, serviceType?: RentalServiceType) {
    return this.prisma.rentalOrder.findMany({
      where: {
        userId,
        ...(serviceType ? { serviceType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Find all (admin) ─────────────────────────────────────────────────────────

  async findAllOrders(serviceType?: RentalServiceType, status?: string) {
    return this.prisma.rentalOrder.findMany({
      where: {
        ...(serviceType ? { serviceType } : {}),
        ...(status && status !== 'ALL' ? { status: status as RentalOrderStatus } : {}),
      },
      include: {
        provider: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Find all (for provider — orders against their listings) ──────────────────

  async findProviderOrders(providerId: string, serviceType?: RentalServiceType) {
    return this.prisma.rentalOrder.findMany({
      where: {
        providerId,
        ...(serviceType ? { serviceType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Find one ────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const order = await this.prisma.rentalOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Rental order not found');
    return order;
  }

  async findByTrackingToken(token: string) {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { trackingToken: token },
    });
    if (!order) throw new NotFoundException('Tracking link not found');
    return order;
  }

  // ── Status update ───────────────────────────────────────────────────────────

  async updateStatus(id: string, carrierId: string, newStatus: RentalOrderStatus) {
    const order = await this.findOne(id);

    if (order.carrierId !== carrierId) {
      throw new ForbiddenException('Not assigned to this order');
    }

    // Skip IN_USE step for services that don't need it
    const isSkippingInUse =
      newStatus === 'IN_USE' && SERVICES_WITHOUT_IN_USE.includes(order.serviceType);
    if (isSkippingInUse) {
      throw new BadRequestException(
        `Service type ${order.serviceType} does not use the IN_USE status`,
      );
    }

    const timestamps = (order.statusTimestamps as Record<string, string>) ?? {};
    timestamps[newStatus] = new Date().toISOString();

    return this.prisma.rentalOrder.update({
      where: { id },
      data: { status: newStatus, statusTimestamps: timestamps },
    });
  }

  // ── Assign carrier ──────────────────────────────────────────────────────────

  async assignCarrier(id: string, carrierId: string) {
    const order = await this.findOne(id);
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Can only assign carrier to PENDING orders');
    }
    const timestamps = (order.statusTimestamps as Record<string, string>) ?? {};
    timestamps['CONFIRMED'] = new Date().toISOString();

    return this.prisma.rentalOrder.update({
      where: { id },
      data: { carrierId, status: 'CONFIRMED', statusTimestamps: timestamps },
    });
  }

  // ── Listings ────────────────────────────────────────────────────────────────

  /** Public — browse listings with optional filters */
  async findListings(
    serviceType?: RentalServiceType,
    city?: string,
    lat?: number,
    lng?: number,
  ) {
    const results = await this.prisma.rentalListing.findMany({
      where: {
        isActive: true,
        ...(serviceType ? { serviceType } : {}),
        ...(city ? { coverageCities: { has: city.toLowerCase() } } : {}),
      },
      include: {
        provider: { select: { id: true, name: true, logo: true, rating: true, verified: true } },
      },
      orderBy: { pricePerDay: 'asc' },
    });

    // If lat/lng provided, filter out listings whose delivery radius doesn't cover it.
    // Listings with no providerLat/Lng or no deliveryRadiusKm are assumed to deliver everywhere.
    if (lat !== undefined && lng !== undefined) {
      return results.filter((l) => {
        if (!l.providerLat || !l.providerLng || !l.deliveryRadiusKm) return true;
        return this.haversineKm(l.providerLat, l.providerLng, lat, lng) <= l.deliveryRadiusKm;
      });
    }
    return results;
  }

  /** Public — single listing detail */
  async findListing(id: string) {
    const listing = await this.prisma.rentalListing.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, name: true, logo: true, rating: true, verified: true, city: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  /** Provider — list own listings */
  async findProviderListings(providerId: string) {
    return this.prisma.rentalListing.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Provider — create listing */
  async createListing(dto: CreateRentalListingDto, providerId: string) {
    return this.prisma.rentalListing.create({
      data: {
        providerId,
        serviceType: dto.serviceType,
        name: dto.name,
        subCategoryLabel: dto.subCategoryLabel ?? null,
        productCode: dto.productCode ?? null,
        description: dto.description ?? null,
        unitLabel: dto.unitLabel ?? 'vienība',
        yearOfManufacture: dto.yearOfManufacture ?? null,
        pricePerDay: dto.pricePerDay,
        vatRate: dto.vatRate ?? 21,
        minHireDays: dto.minHireDays ?? 1,
        maxHireDays: dto.maxHireDays ?? null,
        hirePeriodOptions: (dto.hirePeriodOptions ?? []) as Prisma.InputJsonValue,
        quantityTotal: dto.quantityTotal,
        coverageCities: (dto.coverageCities ?? []).map((c) => c.toLowerCase()),
        deliveryRadiusKm: dto.deliveryRadiusKm ?? null,
        freeDeliveryRadiusKm: dto.freeDeliveryRadiusKm ?? null,
        deliveryFeePerKm: dto.deliveryFeePerKm ?? null,
        providerLat: dto.providerLat ?? null,
        providerLng: dto.providerLng ?? null,
        selfCollectAvailable: dto.selfCollectAvailable ?? false,
        selfCollectAddress: dto.selfCollectAddress ?? null,
        selfCollectLat: dto.selfCollectLat ?? null,
        selfCollectLng: dto.selfCollectLng ?? null,
        blockedDates: dto.blockedDates ?? [],
        imageUrls: dto.imageUrls ?? [],
        documentUrls: dto.documentUrls != null ? (dto.documentUrls as Prisma.InputJsonValue) : Prisma.JsonNull,
        specs: dto.specs != null ? (dto.specs as Prisma.InputJsonValue) : Prisma.JsonNull,
        addOns: dto.addOns != null ? (dto.addOns as Prisma.InputJsonValue) : Prisma.JsonNull,
        insuranceOptions: dto.insuranceOptions != null ? (dto.insuranceOptions as Prisma.InputJsonValue) : Prisma.JsonNull,
        insuranceRequired: dto.insuranceRequired ?? false,
        depositAmount: dto.depositAmount ?? null,
        depositMethod: dto.depositMethod ?? null,
        fuelPolicy: dto.fuelPolicy ?? null,
        cancellationPolicy: dto.cancellationPolicy ?? null,
        lateReturnFeePerDay: dto.lateReturnFeePerDay ?? null,
        requiredDocuments: dto.requiredDocuments != null ? (dto.requiredDocuments as Prisma.InputJsonValue) : Prisma.JsonNull,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /** Provider — update own listing */
  async updateListing(id: string, dto: UpdateRentalListingDto, providerId: string) {
    const listing = await this.prisma.rentalListing.findUnique({ where: { id }, select: { providerId: true } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.providerId !== providerId) throw new ForbiddenException('Not your listing');

    return this.prisma.rentalListing.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.subCategoryLabel !== undefined && { subCategoryLabel: dto.subCategoryLabel }),
        ...(dto.productCode !== undefined && { productCode: dto.productCode }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.unitLabel !== undefined && { unitLabel: dto.unitLabel }),
        ...(dto.yearOfManufacture !== undefined && { yearOfManufacture: dto.yearOfManufacture }),
        ...(dto.pricePerDay !== undefined && { pricePerDay: dto.pricePerDay }),
        ...(dto.vatRate !== undefined && { vatRate: dto.vatRate }),
        ...(dto.minHireDays !== undefined && { minHireDays: dto.minHireDays }),
        ...(dto.maxHireDays !== undefined && { maxHireDays: dto.maxHireDays }),
        ...(dto.hirePeriodOptions !== undefined && { hirePeriodOptions: dto.hirePeriodOptions as Prisma.InputJsonValue }),
        ...(dto.quantityTotal !== undefined && { quantityTotal: dto.quantityTotal }),
        ...(dto.coverageCities !== undefined && { coverageCities: dto.coverageCities.map((c) => c.toLowerCase()) }),
        ...(dto.deliveryRadiusKm !== undefined && { deliveryRadiusKm: dto.deliveryRadiusKm }),
        ...(dto.freeDeliveryRadiusKm !== undefined && { freeDeliveryRadiusKm: dto.freeDeliveryRadiusKm }),
        ...(dto.deliveryFeePerKm !== undefined && { deliveryFeePerKm: dto.deliveryFeePerKm }),
        ...(dto.providerLat !== undefined && { providerLat: dto.providerLat }),
        ...(dto.providerLng !== undefined && { providerLng: dto.providerLng }),
        ...(dto.selfCollectAvailable !== undefined && { selfCollectAvailable: dto.selfCollectAvailable }),
        ...(dto.selfCollectAddress !== undefined && { selfCollectAddress: dto.selfCollectAddress }),
        ...(dto.selfCollectLat !== undefined && { selfCollectLat: dto.selfCollectLat }),
        ...(dto.selfCollectLng !== undefined && { selfCollectLng: dto.selfCollectLng }),
        ...(dto.blockedDates !== undefined && { blockedDates: dto.blockedDates }),
        ...(dto.imageUrls !== undefined && { imageUrls: dto.imageUrls }),
        ...(dto.documentUrls !== undefined && { documentUrls: dto.documentUrls as Prisma.InputJsonValue }),
        ...(dto.specs !== undefined && { specs: dto.specs as Prisma.InputJsonValue }),
        ...(dto.addOns !== undefined && { addOns: dto.addOns as Prisma.InputJsonValue }),
        ...(dto.insuranceOptions !== undefined && { insuranceOptions: dto.insuranceOptions as Prisma.InputJsonValue }),
        ...(dto.insuranceRequired !== undefined && { insuranceRequired: dto.insuranceRequired }),
        ...(dto.depositAmount !== undefined && { depositAmount: dto.depositAmount }),
        ...(dto.depositMethod !== undefined && { depositMethod: dto.depositMethod }),
        ...(dto.fuelPolicy !== undefined && { fuelPolicy: dto.fuelPolicy }),
        ...(dto.cancellationPolicy !== undefined && { cancellationPolicy: dto.cancellationPolicy }),
        ...(dto.lateReturnFeePerDay !== undefined && { lateReturnFeePerDay: dto.lateReturnFeePerDay }),
        ...(dto.requiredDocuments !== undefined && { requiredDocuments: dto.requiredDocuments as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /** Provider — delete own listing */
  async deleteListing(id: string, providerId: string) {
    const listing = await this.prisma.rentalListing.findUnique({ where: { id }, select: { providerId: true } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.providerId !== providerId) throw new ForbiddenException('Not your listing');
    await this.prisma.rentalListing.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Public — return calendar availability for a listing.
   * Returns { blockedDates: string[] } where each date is "YYYY-MM-DD".
   * Combines provider-set blocked dates + dates fully booked by orders.
   */
  async getListingAvailability(id: string) {
    const listing = await this.prisma.rentalListing.findUnique({
      where: { id },
      select: { quantityTotal: true, blockedDates: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    // Fetch all active orders for this listing from today onward
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orders = await this.prisma.rentalOrder.findMany({
      where: {
        listingId: id,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
        deliveryDate: { gte: today },
      },
      select: { deliveryDate: true, hireDays: true, quantity: true },
    });

    // Build a map of date → total quantity booked
    const dateBookedQty = new Map<string, number>();
    for (const order of orders) {
      for (let d = 0; d < order.hireDays; d++) {
        const date = new Date(order.deliveryDate);
        date.setDate(date.getDate() + d);
        const key = date.toISOString().slice(0, 10);
        dateBookedQty.set(key, (dateBookedQty.get(key) ?? 0) + order.quantity);
      }
    }

    // Dates where all units are booked
    const fullyBookedDates = Array.from(dateBookedQty.entries())
      .filter(([, qty]) => qty >= listing.quantityTotal)
      .map(([date]) => date);

    // Merge with provider-set blocked dates (deduplicated)
    const allBlocked = Array.from(new Set([...listing.blockedDates, ...fullyBookedDates])).sort();

    return { blockedDates: allBlocked };
  }

  /**
   * Provider — set blocked dates for a listing.
   * Replaces the full array (idempotent, send desired state).
   */
  async setBlockedDates(id: string, providerId: string, dates: string[]) {
    const listing = await this.prisma.rentalListing.findUnique({ where: { id }, select: { providerId: true } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.providerId !== providerId) throw new ForbiddenException('Not your listing');
    return this.prisma.rentalListing.update({
      where: { id },
      data: { blockedDates: dates },
      select: { id: true, blockedDates: true },
    });
  }

  /**
   * Public — validate that a delivery lat/lng is within the listing's
   * delivery radius. Returns { withinRadius: boolean, distanceKm: number }.
   * If the listing has no radius set, withinRadius is always true.
   */
  async checkDeliveryRadius(id: string, lat: number, lng: number) {
    const listing = await this.prisma.rentalListing.findUnique({
      where: { id },
      select: { deliveryRadiusKm: true, providerLat: true, providerLng: true, coverageCities: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    if (!listing.deliveryRadiusKm || !listing.providerLat || !listing.providerLng) {
      return { withinRadius: true, distanceKm: null };
    }

    const distanceKm = this.haversineKm(
      listing.providerLat, listing.providerLng, lat, lng,
    );
    return {
      withinRadius: distanceKm <= listing.deliveryRadiusKm,
      distanceKm: Math.round(distanceKm * 10) / 10,
      maxRadiusKm: listing.deliveryRadiusKm,
    };
  }

  /** Haversine distance between two lat/lng points in km */
  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Public — compute a full price estimate for a booking.
   * Used by the booking widget to show a live breakdown as the buyer
   * selects dates, add-ons, and insurance.
   */
  async computePriceEstimate(
    id: string,
    hireDays: number,
    selectedAddOnIds: string[],
    insurancePlanId: string | undefined,
    lat: number | undefined,
    lng: number | undefined,
  ) {
    const listing = await this.prisma.rentalListing.findUnique({ where: { id } });
    if (!listing || !listing.isActive) throw new NotFoundException('Listing not found');

    // ── Base cost ──────────────────────────────────────────────────────────
    const basePerDay = listing.pricePerDay;
    const baseCost = basePerDay * hireDays;

    // ── Add-ons ────────────────────────────────────────────────────────────
    type AddOnDef = {
      id: string;
      name: string;
      pricePerDay?: number;
      priceFlat?: number;
      category: string;
      minQty: number;
      maxQty: number;
    };
    const addOnDefs: AddOnDef[] = Array.isArray(listing.addOns)
      ? (listing.addOns as AddOnDef[])
      : [];

    const addOnLines: { id: string; name: string; qty: number; pricePerDay?: number; priceFlat?: number; lineTotal: number }[] = [];
    let addOnTotal = 0;
    for (const addOnId of selectedAddOnIds) {
      const def = addOnDefs.find((a) => a.id === addOnId);
      if (!def) continue;
      const lineTotal = def.pricePerDay != null
        ? def.pricePerDay * hireDays
        : (def.priceFlat ?? 0);
      addOnTotal += lineTotal;
      addOnLines.push({ id: def.id, name: def.name, qty: 1, pricePerDay: def.pricePerDay, priceFlat: def.priceFlat, lineTotal });
    }

    // ── Insurance ──────────────────────────────────────────────────────────
    type InsuranceDef = {
      id: string;
      name: string;
      description: string;
      pricePerDay: number;
      excess: number;
      coversTheft: boolean;
      coversThirdParty: boolean;
    };
    const insuranceDefs: InsuranceDef[] = Array.isArray(listing.insuranceOptions)
      ? (listing.insuranceOptions as InsuranceDef[])
      : [];

    const selectedInsurance = insurancePlanId
      ? insuranceDefs.find((i) => i.id === insurancePlanId) ?? null
      : null;
    const insuranceCost = selectedInsurance ? selectedInsurance.pricePerDay * hireDays : 0;

    // ── Delivery fee ───────────────────────────────────────────────────────
    let deliveryFee = 0;
    if (lat !== undefined && lng !== undefined && listing.providerLat && listing.providerLng) {
      const distKm = this.haversineKm(listing.providerLat, listing.providerLng, lat, lng);
      const freeRadius = listing.freeDeliveryRadiusKm ?? listing.deliveryRadiusKm ?? 0;
      const feePerKm = listing.deliveryFeePerKm ?? 0;
      if (distKm > freeRadius && feePerKm > 0) {
        deliveryFee = Math.round((distKm - freeRadius) * feePerKm * 100) / 100;
      }
    }

    // ── VAT ────────────────────────────────────────────────────────────────
    const vatRate = listing.vatRate ?? 21;
    const priceExclVat = baseCost + addOnTotal + insuranceCost + deliveryFee;
    const vatAmount = Math.round(priceExclVat * vatRate) / 100;
    const priceTotalInclVat = priceExclVat + vatAmount;

    return {
      hireDays,
      vatRate,
      baseCost,
      addOnLines,
      addOnTotal,
      insurance: selectedInsurance
        ? { id: selectedInsurance.id, name: selectedInsurance.name, pricePerDay: selectedInsurance.pricePerDay, total: insuranceCost }
        : null,
      deliveryFee,
      depositAmount: listing.depositAmount ?? null,
      depositMethod: listing.depositMethod ?? null,
      priceExclVat,
      vatAmount,
      priceTotalInclVat,
      currency: listing.currency,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async generateOrderNumber(serviceType: RentalServiceType): Promise<string> {
    const prefixes: Partial<Record<RentalServiceType, string>> = {
      SCAFFOLDING:     'SC',
      TEMP_FENCING:    'TF',
      SITE_OFFICE:     'SO',
      GENERATOR:       'GN',
      LIGHTING_TOWER:  'LT',
      WATER_BOWSER:    'WB',
      MINI_EXCAVATOR:  'ME',
      EXCAVATOR:       'EX',
      DUMPER:          'DP',
      COMPACTOR:       'CP',
      TELEHANDLER:     'TH',
      AERIAL_PLATFORM: 'AP',
    };
    const prefix = prefixes[serviceType] ?? 'RN';
    const suffix = Math.floor(100000 + Math.random() * 900000).toString();
    return `${prefix}-${suffix}`;
  }
}

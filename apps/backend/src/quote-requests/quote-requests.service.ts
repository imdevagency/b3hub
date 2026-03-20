/**
 * Quote requests service.
 * Buyers post material/transport RFQs; suppliers & carriers submit offers.
 * Handles creation, listing, offer submission, offer acceptance, and expiry.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto';
import { CreateQuoteResponseDto } from './dto/create-quote-response.dto';
import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  QuoteRequestStatus,
  QuoteResponseStatus,
} from '@prisma/client';

const INCLUDE_REQUEST = {
  buyer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  responses: {
    orderBy: { pricePerUnit: 'asc' as const },
    include: {
      supplier: {
        select: { id: true, name: true, city: true, rating: true, phone: true },
      },
    },
  },
} as const;

@Injectable()
export class QuoteRequestsService {
  private readonly logger = new Logger(QuoteRequestsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Buyer: create request ────────────────────────────────────
  async create(dto: CreateQuoteRequestDto, userId: string) {
    const requestNumber = await this.generateRequestNumber();
    const request = await this.prisma.quoteRequest.create({
      data: {
        requestNumber,
        buyerId: userId,
        materialCategory: dto.materialCategory,
        materialName: dto.materialName,
        quantity: dto.quantity,
        unit: dto.unit,
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        notes: dto.notes,
        status: QuoteRequestStatus.PENDING,
      },
      include: INCLUDE_REQUEST,
    });
    this.logger.log(
      `Quote request ${request.requestNumber} created by user ${userId}`,
    );
    return request;
  }

  // ── Buyer: get single request with responses ─────────────────
  async findOne(id: string, userId: string) {
    const req = await this.prisma.quoteRequest.findUnique({
      where: { id },
      include: INCLUDE_REQUEST,
    });
    if (!req) throw new NotFoundException('Quote request not found');
    if (req.buyerId !== userId)
      throw new ForbiddenException('Not your request');
    return req;
  }

  // ── Buyer: list their own requests ───────────────────────────
  async findAll(userId: string, limit: number = 20, skip: number = 0) {
    const [data, total] = await Promise.all([
      this.prisma.quoteRequest.findMany({
        where: { buyerId: userId },
        include: INCLUDE_REQUEST,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.quoteRequest.count({
        where: { buyerId: userId },
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    };
  }

  // ── Buyer: accept a specific supplier response → creates order
  async acceptResponse(requestId: string, responseId: string, userId: string) {
    const req = await this.findOne(requestId, userId);
    if (
      req.status !== QuoteRequestStatus.PENDING &&
      req.status !== QuoteRequestStatus.QUOTED
    ) {
      throw new BadRequestException('This request is no longer open');
    }

    const response = req.responses.find((r) => r.id === responseId);
    if (!response) throw new NotFoundException('Quote response not found');
    if (response.status !== QuoteResponseStatus.PENDING) {
      throw new BadRequestException('This response is no longer available');
    }

    // Transact: mark request accepted, mark chosen response accepted,
    //           mark others rejected, create the order
    const [, , order] = await this.prisma.$transaction(async (tx) => {
      const updReq = await tx.quoteRequest.update({
        where: { id: requestId },
        data: { status: QuoteRequestStatus.ACCEPTED },
      });

      const updResp = await tx.quoteResponse.update({
        where: { id: responseId },
        data: { status: QuoteResponseStatus.ACCEPTED },
      });

      // Reject other responses
      await tx.quoteResponse.updateMany({
        where: { requestId, NOT: { id: responseId } },
        data: { status: QuoteResponseStatus.REJECTED },
      });

      // Find or create a material record belonging to supplier (best-effort)
      const existingMaterial = await tx.material.findFirst({
        where: {
          supplierId: response.supplierId,
          category: req.materialCategory,
          active: true,
        },
      });

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const unitPrice = response.pricePerUnit;
      const subtotal = Math.round(unitPrice * req.quantity * 100) / 100;
      const tax = Math.round(subtotal * 0.21 * 100) / 100;
      const total = subtotal + tax;

      // We need a buyer company — find the company the buyer belongs to
      const buyer = await tx.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
      });

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          orderType: OrderType.MATERIAL,
          buyerId: buyer?.companyId ?? response.supplierId, // fallback
          createdById: userId,
          deliveryAddress: req.deliveryAddress,
          deliveryCity: req.deliveryCity,
          deliveryState: '-',
          deliveryPostal: '',
          subtotal,
          tax,
          deliveryFee: 0,
          total,
          currency: 'EUR',
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PENDING,
          notes: `Quote request ${req.requestNumber}. ${req.notes ?? ''}`,
          ...(existingMaterial
            ? {
                items: {
                  create: [
                    {
                      materialId: existingMaterial.id,
                      quantity: req.quantity,
                      unit: req.unit,
                      unitPrice,
                      total: subtotal,
                    },
                  ],
                },
              }
            : {}),
        },
        include: {
          items: {
            include: { material: { select: { name: true, category: true } } },
          },
        },
      });

      return [updReq, updResp, newOrder] as const;
    });

    // Notify supplier's users that their quote was accepted (fire-and-forget)
    const supplierUsers = await this.prisma.user.findMany({
      where: { companyId: response.supplierId },
      select: { id: true },
    });
    for (const u of supplierUsers) {
      this.notifications
        .create({
          userId: u.id,
          type: NotificationType.QUOTE_ACCEPTED,
          title: 'Piedāvājums pieņemts!',
          message: `Pircējs pieņēma jūsu piedāvājumu par pieprasījumu #${req.requestNumber}.`,
          data: { requestId, orderId: order.id },
        })
        .catch(() => null);
    }

    return order;
  }

  // ── Supplier: respond to a request ───────────────────────────
  async addResponse(
    requestId: string,
    dto: CreateQuoteResponseDto,
    companyId: string,
  ) {
    const req = await this.prisma.quoteRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('Quote request not found');
    if (
      req.status !== QuoteRequestStatus.PENDING &&
      req.status !== QuoteRequestStatus.QUOTED
    ) {
      throw new BadRequestException(
        'This request is no longer accepting responses',
      );
    }

    const totalPrice = Math.round(dto.pricePerUnit * req.quantity * 100) / 100;
    const resp = await this.prisma.quoteResponse.create({
      data: {
        requestId,
        supplierId: companyId,
        pricePerUnit: dto.pricePerUnit,
        totalPrice,
        unit: dto.unit,
        etaDays: dto.etaDays,
        notes: dto.notes,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        status: QuoteResponseStatus.PENDING,
      },
      include: {
        supplier: { select: { id: true, name: true, city: true } },
      },
    });

    // Transition request → QUOTED now that at least one response exists
    await this.prisma.quoteRequest.update({
      where: { id: requestId },
      data: { status: QuoteRequestStatus.QUOTED },
    });

    // Notify buyer of new quote response (fire-and-forget)
    this.notifications
      .create({
        userId: req.buyerId,
        type: NotificationType.QUOTE_RECEIVED,
        title: 'Jauns piedāvājums saņemts',
        message: `Saņemts jauns piedāvājums par pieprasījumu #${req.requestNumber}.`,
        data: { requestId },
      })
      .catch(() => null);

    return resp;
  }

  // ── Supplier: list all open requests they can respond to ─────
  async findOpenRequests(limit: number = 20, skip: number = 0) {
    const [data, total] = await Promise.all([
      this.prisma.quoteRequest.findMany({
        where: {
          status: { in: [QuoteRequestStatus.PENDING, QuoteRequestStatus.QUOTED] },
        },
        include: {
          buyer: { select: { firstName: true, lastName: true } },
          responses: { select: { supplierId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.quoteRequest.count({
        where: {
          status: { in: [QuoteRequestStatus.PENDING, QuoteRequestStatus.QUOTED] },
        },
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────
  private async generateRequestNumber(): Promise<string> {
    const count = await this.prisma.quoteRequest.count();
    const seq = String(count + 1).padStart(5, '0');
    return `QR-${seq}`;
  }
}

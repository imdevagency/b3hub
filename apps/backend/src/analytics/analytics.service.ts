/**
 * Analytics service.
 * Provides ERP-style reporting aggregations:
 *
 * - Revenue trend (last 12 months, by month)
 * - Order breakdown by status
 * - Invoice AR aging buckets (0-30, 31-60, 61-90, 90+ days overdue)
 * - Supplier performance KPIs (avg rating, on-time %, completed orders)
 *
 * All data comes from existing tables — no new schema changes required.
 */
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import PDFDocument from 'pdfkit';

/** kg CO2 emitted per km driven, by vehicle type (HBEFA 3.3 averages, EU) */
const CO2_KG_PER_KM: Record<string, number> = {
  DUMP_TRUCK: 0.9,
  FLATBED_TRUCK: 0.85,
  SEMI_TRAILER: 1.2,
  HOOK_LIFT: 0.9,
  SKIP_LOADER: 0.7,
  TANKER: 1.1,
  VAN: 0.35,
};

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Full analytics overview for the requesting user.
   * Returns buyer stats + seller stats (if canSell) + carrier stats (if canTransport).
   */
  async getOverview(user: RequestingUser) {
    const { userId, companyId, canSell, canTransport } = user;

    const [buyer, seller, carrier] = await Promise.all([
      this.getBuyerAnalytics(userId, companyId),
      canSell && companyId ? this.getSellerAnalytics(companyId) : null,
      canTransport && companyId ? this.getCarrierAnalytics(companyId) : null,
    ]);

    return { buyer, seller, carrier };
  }

  // ─── Buyer analytics ─────────────────────────────────────────────────────

  private async getBuyerAnalytics(userId: string, companyId?: string) {
    const buyerWhere = companyId
      ? { OR: [{ buyerId: companyId }, { createdById: userId }] }
      : { createdById: userId };

    const now = new Date();
    const [orderBreakdown, arAging, monthlySpend, rawItems, deliveredJobs] =
      await Promise.all([
        // Orders by status
        this.prisma.order.groupBy({
          by: ['status'],
          where: buyerWhere,
          _count: { id: true },
          _sum: { total: true },
        }),
        // Invoice AR aging — outstanding invoices past due date
        this.getArAging(userId, companyId),
        // Monthly spend for current year
        this.getMonthlySpend(userId, companyId),
        // Order items for material category breakdown
        this.prisma.orderItem.findMany({
          where: { order: buyerWhere },
          select: {
            total: true,
            quantity: true,
            material: { select: { category: true } },
          },
        }),
        // Delivered transport jobs for CO2 estimate
        this.prisma.transportJob.findMany({
          where: {
            status: 'DELIVERED',
            order: buyerWhere,
            distanceKm: { not: null },
          },
          select: { distanceKm: true, requiredVehicleEnum: true },
        }),
      ]);

    // Material spend breakdown by category
    const catMap: Record<string, { totalSpent: number; orderCount: number }> =
      {};
    for (const item of rawItems) {
      const cat = item.material.category;
      if (!catMap[cat]) catMap[cat] = { totalSpent: 0, orderCount: 0 };
      catMap[cat].totalSpent += item.total;
      catMap[cat].orderCount++;
    }
    const materialBreakdown = Object.entries(catMap)
      .map(([category, s]) => ({ category, ...s }))
      .sort((a, b) => b.totalSpent - a.totalSpent);

    // CO2 estimate (kg) across all delivered transport jobs this buyer generated
    const co2Kg = deliveredJobs.reduce((sum, job) => {
      const factor = CO2_KG_PER_KM[job.requiredVehicleEnum ?? ''] ?? 0.9;
      return sum + (job.distanceKm ?? 0) * factor;
    }, 0);

    return {
      orderBreakdown,
      arAging,
      monthlySpend,
      materialBreakdown,
      co2Kg,
      asOf: now.toISOString(),
    };
  }

  private async getArAging(userId: string, companyId?: string) {
    const buyerWhere = companyId
      ? { OR: [{ buyerId: companyId }, { createdById: userId }] }
      : { createdById: userId };

    const invoices = await this.prisma.invoice.findMany({
      where: {
        paymentStatus: {
          in: [PaymentStatus.PENDING, PaymentStatus.PARTIALLY_PAID],
        },
        order: buyerWhere,
      },
      select: { id: true, total: true, dueDate: true, paymentStatus: true },
    });

    const now = Date.now();
    const buckets = {
      current: { count: 0, total: 0 },
      days30: { count: 0, total: 0 },
      days60: { count: 0, total: 0 },
      days90: { count: 0, total: 0 },
      over90: { count: 0, total: 0 },
    };

    for (const inv of invoices) {
      if (!inv.dueDate) {
        // No due date set — treat as current (not yet overdue)
        buckets['current'].count++;
        buckets['current'].total += inv.total;
        continue;
      }
      const daysPast = Math.floor((now - inv.dueDate.getTime()) / 86_400_000);
      const key =
        daysPast <= 0
          ? 'current'
          : daysPast <= 30
            ? 'days30'
            : daysPast <= 60
              ? 'days60'
              : daysPast <= 90
                ? 'days90'
                : 'over90';
      buckets[key].count++;
      buckets[key].total += inv.total;
    }

    return buckets;
  }

  private async getMonthlySpend(userId: string, companyId?: string) {
    const buyerWhere = companyId
      ? { OR: [{ buyerId: companyId }, { createdById: userId }] }
      : { createdById: userId };

    const yearAgo = new Date();
    yearAgo.setMonth(yearAgo.getMonth() - 11);
    yearAgo.setDate(1);
    yearAgo.setHours(0, 0, 0, 0);

    const orders = await this.prisma.order.findMany({
      where: {
        ...buyerWhere,
        status: { in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] },
        createdAt: { gte: yearAgo },
      },
      select: { total: true, createdAt: true },
    });

    return this.aggregateByMonth(orders, (o) => o.total);
  }

  // ─── Seller analytics ─────────────────────────────────────────────────────

  private async getSellerAnalytics(companyId: string) {
    const [monthlyRevenue, orderBreakdown, performanceStats, topMaterials] =
      await Promise.all([
        this.getMonthlyRevenue(companyId),
        this.prisma.order.groupBy({
          by: ['status'],
          where: { items: { some: { material: { supplierId: companyId } } } },
          _count: { id: true },
          _sum: { total: true },
        }),
        this.getPerformanceStats(companyId),
        this.getTopMaterials(companyId),
      ]);

    return { monthlyRevenue, orderBreakdown, performanceStats, topMaterials };
  }

  private async getMonthlyRevenue(companyId: string) {
    const yearAgo = new Date();
    yearAgo.setMonth(yearAgo.getMonth() - 11);
    yearAgo.setDate(1);
    yearAgo.setHours(0, 0, 0, 0);

    const items = await this.prisma.orderItem.findMany({
      where: {
        material: { supplierId: companyId },
        order: {
          status: { in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] },
          createdAt: { gte: yearAgo },
        },
      },
      select: { total: true, order: { select: { createdAt: true } } },
    });

    return this.aggregateByMonth(
      items,
      (i) => i.total,
      (i) => i.order.createdAt,
    );
  }

  private async getPerformanceStats(companyId: string) {
    const [reviews, totalOrders, completedOrders, onTimeRate] =
      await Promise.all([
        this.prisma.review.aggregate({
          where: { companyId },
          _avg: { rating: true },
          _count: { id: true },
        }),
        this.prisma.order.count({
          where: { items: { some: { material: { supplierId: companyId } } } },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.COMPLETED,
            items: { some: { material: { supplierId: companyId } } },
          },
        }),
        this.getOnTimeDeliveryRate(companyId),
      ]);

    const completionRate =
      totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    return {
      avgRating: reviews._avg.rating ?? 0,
      totalReviews: reviews._count.id,
      totalOrders,
      completedOrders,
      completionRate,
      onTimeRate,
    };
  }

  /** On-time delivery rate: % of DELIVERED transport jobs where actual
   *  delivery (statusUpdatedAt) was at or before the planned deliveryDate + 30 min. */
  private async getOnTimeDeliveryRate(companyId: string): Promise<number> {
    const jobs = await this.prisma.transportJob.findMany({
      where: {
        status: 'DELIVERED',
        order: {
          items: { some: { material: { supplierId: companyId } } },
        },
      },
      select: { deliveryDate: true, statusUpdatedAt: true },
    });

    if (jobs.length === 0) return 0;

    const onTimeCount = jobs.filter((j) => {
      if (!j.statusUpdatedAt) return true; // no timestamp = assume on time
      const graceMs = 30 * 60 * 1000; // 30 min grace
      return j.statusUpdatedAt.getTime() <= j.deliveryDate.getTime() + graceMs;
    }).length;

    return Math.round((onTimeCount / jobs.length) * 100);
  }

  /** Public supplier performance scores — for buyer catalog and admin views */
  async getSupplierScores() {
    const suppliers = await this.prisma.company.findMany({
      where: { materials: { some: { active: true } } },
      select: {
        id: true,
        name: true,
        city: true,
        companyType: true,
        rating: true,
      },
    });

    const scores = await Promise.all(
      suppliers.map(async (s) => ({
        companyId: s.id,
        name: s.name,
        city: s.city,
        companyType: s.companyType,
        ...(await this.getPerformanceStats(s.id)),
      })),
    );

    return scores.sort((a, b) => b.avgRating - a.avgRating);
  }

  private async getTopMaterials(companyId: string) {
    const items = await this.prisma.orderItem.groupBy({
      by: ['materialId'],
      where: {
        material: { supplierId: companyId },
        order: {
          status: { in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] },
        },
      },
      _sum: { total: true, quantity: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    });

    const materialIds = items.map((i) => i.materialId);
    const materials = await this.prisma.material.findMany({
      where: { id: { in: materialIds } },
      select: { id: true, name: true, unit: true },
    });
    const matMap = Object.fromEntries(materials.map((m) => [m.id, m]));

    return items.map((i) => ({
      material: matMap[i.materialId],
      revenue: i._sum.total ?? 0,
      quantity: i._sum.quantity ?? 0,
      orderCount: i._count.id,
    }));
  }

  // ─── Carrier analytics ─────────────────────────────────────────────────────

  private async getCarrierAnalytics(companyId: string) {
    const yearAgo = new Date();
    yearAgo.setMonth(yearAgo.getMonth() - 11);
    yearAgo.setDate(1);
    yearAgo.setHours(0, 0, 0, 0);

    const [monthlyEarnings, jobBreakdown, fleetUtilization] = await Promise.all(
      [
        this.getMonthlyCarrierEarnings(companyId, yearAgo),
        this.prisma.transportJob.groupBy({
          by: ['status'],
          where: { carrierId: companyId },
          _count: { id: true },
          _sum: { rate: true },
        }),
        this.getFleetUtilization(companyId),
      ],
    );

    return { monthlyEarnings, jobBreakdown, fleetUtilization };
  }

  private async getMonthlyCarrierEarnings(companyId: string, yearAgo: Date) {
    const jobs = await this.prisma.transportJob.findMany({
      where: {
        carrierId: companyId,
        status: 'DELIVERED',
        updatedAt: { gte: yearAgo },
      },
      select: { rate: true, updatedAt: true },
    });

    return this.aggregateByMonth(
      jobs,
      (j) => j.rate,
      (j) => j.updatedAt,
    );
  }

  private async getFleetUtilization(companyId: string) {
    const [total, active, inUse] = await Promise.all([
      this.prisma.vehicle.count({ where: { companyId } }),
      this.prisma.vehicle.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.vehicle.count({ where: { companyId, status: 'IN_USE' } }),
    ]);
    const utilizationRate =
      total > 0 ? Math.round(((active + inUse) / total) * 100) : 0;
    return { total, active, inUse, utilizationRate };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Groups an array of records by calendar month (YYYY-MM).
   * Returns the last 12 months as an ordered array (oldest → newest).
   */
  private aggregateByMonth<T>(
    records: T[],
    getValue: (r: T) => number,
    getDate?: (r: T) => Date,
  ): { month: string; value: number }[] {
    const map: Record<string, number> = {};

    for (const r of records) {
      const date = getDate ? getDate(r) : (r as { createdAt: Date }).createdAt;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] ?? 0) + getValue(r);
    }

    // Build the last 12 month slots
    const result: { month: string; value: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push({ month: key, value: map[key] ?? 0 });
    }
    return result;
  }

  // ─── Delivery Calendar ────────────────────────────────────────────────────

  async getDeliveryCalendar(user: RequestingUser) {
    const { userId, companyId, canSell, canTransport } = user;
    const now = new Date();
    const sixWeeksOut = new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000);

    const buyerWhere = companyId
      ? { OR: [{ buyerId: companyId }, { createdById: userId }] }
      : { createdById: userId };

    const activeOrderStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.IN_PROGRESS,
      OrderStatus.DELIVERED,
    ] as const;

    const [buyerOrders, sellerOrders, carrierJobs] = await Promise.all([
      // Buyer: their upcoming confirmed orders
      this.prisma.order.findMany({
        where: {
          ...buyerWhere,
          status: { in: [...activeOrderStatuses] },
          deliveryDate: { gte: now, lte: sixWeeksOut },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          deliveryDate: true,
          deliveryAddress: true,
          deliveryCity: true,
          total: true,
          items: {
            select: { material: { select: { name: true, category: true } } },
            take: 1,
          },
        },
        orderBy: { deliveryDate: 'asc' },
      }),
      // Seller: orders assigned to their materials
      canSell && companyId
        ? this.prisma.order.findMany({
            where: {
              status: { in: [...activeOrderStatuses] },
              deliveryDate: { gte: now, lte: sixWeeksOut },
              items: { some: { material: { supplierId: companyId } } },
            },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              deliveryDate: true,
              deliveryAddress: true,
              deliveryCity: true,
              total: true,
              items: {
                select: {
                  material: { select: { name: true, category: true } },
                },
                take: 1,
              },
            },
            orderBy: { deliveryDate: 'asc' },
          })
        : Promise.resolve([]),
      // Carrier: their upcoming transport jobs
      canTransport && companyId
        ? this.prisma.transportJob.findMany({
            where: {
              carrierId: companyId,
              status: {
                in: [
                  'AVAILABLE',
                  'ACCEPTED',
                  'EN_ROUTE_PICKUP',
                  'AT_PICKUP',
                  'LOADED',
                  'EN_ROUTE_DELIVERY',
                  'AT_DELIVERY',
                ] as const,
              },
              deliveryDate: { gte: now, lte: sixWeeksOut },
            },
            select: {
              id: true,
              jobNumber: true,
              status: true,
              deliveryDate: true,
              deliveryAddress: true,
              deliveryCity: true,
              rate: true,
              order: {
                select: {
                  orderNumber: true,
                  items: {
                    select: { material: { select: { name: true } } },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { deliveryDate: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    // Map to unified shape, deduplicate by id+type
    const seen = new Set<string>();
    const entries: {
      id: string;
      type: 'ORDER' | 'JOB';
      ref: string;
      status: string;
      deliveryDate: string;
      address: string;
      city: string;
      materialName: string | null;
      amount: number;
      role: 'BUYER' | 'SELLER' | 'CARRIER';
    }[] = [];

    for (const o of [...buyerOrders, ...sellerOrders]) {
      const key = `ORDER-${o.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        id: o.id,
        type: 'ORDER',
        ref: o.orderNumber,
        status: o.status,
        deliveryDate: o.deliveryDate!.toISOString(),
        address: o.deliveryAddress,
        city: o.deliveryCity,
        materialName: o.items[0]?.material?.name ?? null,
        amount: o.total,
        role: buyerOrders.some((b) => b.id === o.id) ? 'BUYER' : 'SELLER',
      });
    }

    for (const j of carrierJobs) {
      entries.push({
        id: j.id,
        type: 'JOB',
        ref: j.jobNumber ?? j.order?.orderNumber,
        status: j.status,
        deliveryDate: j.deliveryDate.toISOString(),
        address: j.deliveryAddress,
        city: j.deliveryCity,
        materialName: j.order?.items[0]?.material?.name ?? null,
        amount: j.rate,
        role: 'CARRIER',
      });
    }

    return entries.sort(
      (a, b) =>
        new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime(),
    );
  }

  // ─── PDF Report ───────────────────────────────────────────────────────────

  async generateReport(user: RequestingUser): Promise<Buffer> {
    const data = await this.getOverview(user);
    const { buyer, seller, carrier } = data;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const euro = (v: number) =>
        `EUR ${v.toLocaleString('en-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const pct = (v: number) => `${Math.round(v)}%`;
      const today = new Date().toLocaleDateString('lv-LV');

      // ── Header ──────────────────────────────────────────────────────────
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('B3Hub', 50, 50);
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('b3hub.lv  |  support@b3hub.lv', 50, 78);
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('Analītikas Pārskats', 0, 52, { align: 'right' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text(today, 0, 78, { align: 'right' });

      doc.moveTo(50, 105).lineTo(545, 105).strokeColor('#e5e7eb').stroke();

      let y = 120;

      const sectionTitle = (title: string) => {
        y += 12;
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#111827')
          .text(title, 50, y);
        y += 22;
        doc.moveTo(50, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
        y += 10;
      };

      const row = (label: string, value: string, bold = false) => {
        doc
          .fontSize(10)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor('#374151')
          .text(label, 50, y);
        doc
          .fontSize(10)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor('#111827')
          .text(value, 0, y, { align: 'right' });
        y += 18;
      };

      // ── Buyer section ────────────────────────────────────────────────────
      if (buyer) {
        sectionTitle('Izdevumi (Pasūtītājs)');
        const totalSpend = buyer.monthlySpend.reduce((s, m) => s + m.value, 0);
        row('Kopējie izdevumi (pēdējie 12 mēn.)', euro(totalSpend), true);
        if ((buyer.co2Kg ?? 0) > 0) {
          row(
            'CO₂ emisijas (aprēķināts)',
            `${Math.round(buyer.co2Kg).toLocaleString('lv-LV')} kg`,
          );
        }
        y += 6;

        // Monthly spend (last 6)
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#6b7280')
          .text('Mēnešu izdevumi', 50, y);
        y += 16;
        for (const m of buyer.monthlySpend.slice(-6)) {
          const [yr, mo] = m.month.split('-');
          const label = new Date(Number(yr), Number(mo) - 1).toLocaleString(
            'lv-LV',
            { month: 'long', year: 'numeric' },
          );
          row(label, euro(m.value));
        }
        y += 6;

        // Material breakdown
        if (buyer.materialBreakdown?.length) {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#6b7280')
            .text('Izdevumi pēc materiāla', 50, y);
          y += 16;
          for (const b of buyer.materialBreakdown.slice(0, 5)) {
            row(b.category, euro(b.totalSpent));
          }
          y += 6;
        }

        // Order breakdown
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#6b7280')
          .text('Pasūtījumi pēc statusa', 50, y);
        y += 16;
        for (const b of buyer.orderBreakdown) {
          row(b.status, `${b._count.id} (${euro(b._sum?.total ?? 0)})`);
        }
      }

      // ── Seller section ───────────────────────────────────────────────────
      if (seller) {
        if (y > 650) {
          doc.addPage();
          y = 50;
        }
        sectionTitle('Ieņēmumi (Piegādātājs)');
        const totalRevenue = seller.monthlyRevenue.reduce(
          (s, m) => s + m.value,
          0,
        );
        row('Kopējie ieņēmumi (pēdējie 12 mēn.)', euro(totalRevenue), true);
        row(
          'Vidējais vērtējums',
          `${seller.performanceStats.avgRating.toFixed(1)} (${seller.performanceStats.totalReviews} atsauksmes)`,
        );
        row('Izpildes rādītājs', pct(seller.performanceStats.completionRate));
        row('Laicīgums', pct(seller.performanceStats.onTimeRate));
        y += 6;

        if (seller.topMaterials.length) {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#6b7280')
            .text('Populārākie materiāli', 50, y);
          y += 16;
          for (const m of seller.topMaterials) {
            row(m.material?.name ?? '-', euro(m.revenue));
          }
        }
      }

      // ── Carrier section ──────────────────────────────────────────────────
      if (carrier) {
        if (y > 650) {
          doc.addPage();
          y = 50;
        }
        sectionTitle('Ienākumi (Pārvadātājs)');
        const totalEarnings = carrier.monthlyEarnings.reduce(
          (s, m) => s + m.value,
          0,
        );
        row('Kopējie ienākumi (pēdējie 12 mēn.)', euro(totalEarnings), true);
        row('Flotes noslodze', pct(carrier.fleetUtilization.utilizationRate));
        row('Transportlīdzekļi kopā', `${carrier.fleetUtilization.total}`);
        row('Aktīvie', `${carrier.fleetUtilization.active}`);
        row('Darbā', `${carrier.fleetUtilization.inUse}`);
      }

      // ── Footer ───────────────────────────────────────────────────────────
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#9ca3af')
        .text(
          'B3Hub SIA  |  Rīga, Latvija  |  support@b3hub.lv  |  b3hub.lv',
          50,
          750,
          {
            align: 'center',
          },
        );

      doc.end();
    });
  }

  // ─── Nightly supplier stats cache ────────────────────────────────────────

  /**
   * Batch-refreshes onTimePct + fulfillmentPct on all active supplier companies.
   * Runs nightly at 02:00 so catalog reads are always hitting indexed columns,
   * not running per-query aggregations.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async refreshSupplierStats(): Promise<void> {
    const suppliers = await this.prisma.company.findMany({
      where: { materials: { some: { active: true } } },
      select: { id: true },
    });

    for (const supplier of suppliers) {
      const [totalOrders, completedOrders, onTimeRate] = await Promise.all([
        this.prisma.order.count({
          where: { items: { some: { material: { supplierId: supplier.id } } } },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.COMPLETED,
            items: { some: { material: { supplierId: supplier.id } } },
          },
        }),
        this.getOnTimeDeliveryRate(supplier.id),
      ]);

      const fulfillmentPct =
        totalOrders > 0
          ? Math.round((completedOrders / totalOrders) * 100)
          : null;

      await this.prisma.company.update({
        where: { id: supplier.id },
        data: {
          onTimePct: onTimeRate > 0 ? onTimeRate : null,
          fulfillmentPct,
        },
      });
    }
  }
}

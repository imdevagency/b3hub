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
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface';

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
    const [orderBreakdown, arAging, monthlySpend] = await Promise.all([
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
    ]);

    return { orderBreakdown, arAging, monthlySpend, asOf: now.toISOString() };
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
      const date = getDate ? getDate(r) : ((r as any).createdAt as Date);
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
}

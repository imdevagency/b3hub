import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/** Latvia retail diesel baseline (EUR/L incl. tax) used as fallback */
const BASELINE_DIESEL_LV = 1.45;

/** Fraction of transport cost attributable to fuel (used for multiplier) */
const FUEL_COST_SHARE = 0.30;

/** Assumed fuel consumption for a loaded dump truck (L/100 km) */
export const TRUCK_L_PER_100KM = 35;

export interface FuelRates {
  diesel: number;           // EUR per litre, current Latvia retail
  fuelMultiplier: number;   // factor to apply to transport estimates (1.0 = no change)
  truckLPer100km: number;   // published assumption for UI transparency
  source: string;           // "eurostat" | "manual" | "seed"
  updatedAt: string;        // ISO-8601 date of the last reading
}

@Injectable()
export class FuelService {
  private readonly logger = new Logger(FuelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns the latest stored diesel price, seeding a baseline row if the table is empty. */
  async getLatest(): Promise<FuelRates> {
    let record = await this.prisma.fuelPrice.findFirst({
      orderBy: { date: 'desc' },
    });

    if (!record) {
      record = await this.prisma.fuelPrice.create({
        data: {
          date: new Date(),
          pricePerLitre: BASELINE_DIESEL_LV,
          source: 'seed',
          country: 'LV',
        },
      });
      this.logger.log(`Seeded baseline fuel price €${BASELINE_DIESEL_LV}/L`);
    }

    return this.toRates(record);
  }

  /**
   * Weekly cron — every Monday at 07:00 Latvia time (UTC+3 = 04:00 UTC).
   * Fetches the latest Latvia diesel retail price from Eurostat and stores it.
   * Falls back gracefully if the fetch fails — the last stored value stays active.
   */
  @Cron('0 4 * * 1')
  async fetchAndStore(): Promise<void> {
    this.logger.log('Fetching latest Latvia diesel price from Eurostat...');
    try {
      const price = await this.fetchEurostatDieselLV();
      if (price) {
        await this.prisma.fuelPrice.create({
          data: {
            date: new Date(),
            pricePerLitre: price,
            source: 'eurostat',
            country: 'LV',
          },
        });
        this.logger.log(`Stored Latvia diesel price: €${price}/L`);
      }
    } catch (err) {
      this.logger.warn(`Fuel price fetch failed, keeping last value. Error: ${String(err)}`);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Fetches the latest weekly Latvia retail diesel price (EUR/L, incl. taxes)
   * from the Eurostat dissemination API.
   *
   * Dataset: nrg_pc_202_c — Motor fuel prices, consumers, weekly
   *   product: 4630 = diesel
   *   geo:     LV   = Latvia
   *   tax:     I_TAX = including all taxes
   *   unit:    LHR  = EUR per litre
   *   freq:    W    = weekly
   */
  private async fetchEurostatDieselLV(): Promise<number | null> {
    const url =
      'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/' +
      'nrg_pc_202_c?geo=LV&product=4630&tax=I_TAX&unit=LHR&freq=W&lastTimePeriod=1&format=JSON';

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Eurostat responded ${res.status}`);
    }

    const json = (await res.json()) as { value?: Record<string, number> };
    const values = json?.value;
    if (!values) return null;

    const [first] = Object.values(values);
    if (typeof first !== 'number' || first <= 0) return null;

    // Eurostat reports in EUR per litre — sanity-check range (€0.80 – €3.00)
    if (first < 0.8 || first > 3.0) {
      this.logger.warn(`Eurostat returned unexpected value: ${first} — ignoring`);
      return null;
    }

    return Math.round(first * 1000) / 1000; // 3 decimal places
  }

  private toRates(record: { pricePerLitre: number; source: string; date: Date }): FuelRates {
    const diesel = record.pricePerLitre;
    const multiplier =
      1 + ((diesel - BASELINE_DIESEL_LV) / BASELINE_DIESEL_LV) * FUEL_COST_SHARE;

    return {
      diesel,
      fuelMultiplier: Math.round(multiplier * 1000) / 1000,
      truckLPer100km: TRUCK_L_PER_100KM,
      source: record.source,
      updatedAt: record.date.toISOString(),
    };
  }

  /** Estimate fuel cost for a given km distance (using current diesel price). */
  async estimateFuelCost(distanceKm: number): Promise<number> {
    const rates = await this.getLatest();
    return (distanceKm / 100) * TRUCK_L_PER_100KM * rates.diesel;
  }
}

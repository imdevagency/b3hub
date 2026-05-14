import { Controller, Get, Query } from '@nestjs/common';
import { CatalogueService } from './catalogue.service';

/**
 * Public read-only catalogue endpoints — no auth required.
 * Returns admin-managed taxonomy definitions that drive wizards on mobile/web.
 */
@Controller('catalogue')
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  /** Material category definitions with density, default unit, and descriptions */
  @Get('material-categories')
  getMaterialCategories() {
    return this.catalogueService.getMaterialCategories();
  }

  /** Material fractions. Filter by ?category=GRAVEL to get only one category's fractions. */
  @Get('material-fractions')
  getMaterialFractions(@Query('category') category?: string) {
    return this.catalogueService.getMaterialFractions(category);
  }

  /** Transport service categories (vehicle types with pricing hints) */
  @Get('vehicle-categories')
  getVehicleCategories() {
    return this.catalogueService.getVehicleCategories();
  }

  /** Toilet cabin type definitions */
  @Get('toilet-cabin-types')
  getToiletCabinTypes() {
    return this.catalogueService.getToiletCabinTypes();
  }

  /** Equipment rental service type definitions */
  @Get('rental-service-types')
  getRentalServiceTypes() {
    return this.catalogueService.getRentalServiceTypes();
  }

  /** Scrap buyback material definitions */
  @Get('scrap-materials')
  getScrapMaterials() {
    return this.catalogueService.getScrapMaterials();
  }

  /** Waste type definitions for the disposal/utilization wizard.
   *  Filter by ?group=CONSTRUCTION_WASTE | LICENSED_WASTE | SECONDARY_MATERIALS */
  @Get('waste-types')
  getWasteTypes(@Query('group') group?: string) {
    return this.catalogueService.getWasteTypes(group);
  }
}

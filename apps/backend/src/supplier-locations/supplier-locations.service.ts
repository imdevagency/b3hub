/**
 * Supplier Locations service.
 * CRUD for quarry / loading sites owned by a supplier company.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierLocationDto } from './dto/create-supplier-location.dto';
import { UpdateSupplierLocationDto } from './dto/update-supplier-location.dto';

@Injectable()
export class SupplierLocationsService {
  private readonly logger = new Logger(SupplierLocationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByCompany(supplierId: string) {
    return this.prisma.supplierLocation.findMany({
      where: { supplierId, active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(supplierId: string, dto: CreateSupplierLocationDto) {
    const location = await this.prisma.supplierLocation.create({
      data: { ...dto, supplierId },
    });
    this.logger.log(`SupplierLocation ${location.id} created for company ${supplierId}`);
    return location;
  }

  async update(
    id: string,
    supplierId: string,
    dto: UpdateSupplierLocationDto,
  ) {
    await this.assertOwnership(id, supplierId);
    return this.prisma.supplierLocation.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, supplierId: string) {
    await this.assertOwnership(id, supplierId);
    // Soft-delete: set active=false so existing material links remain valid
    await this.prisma.supplierLocation.update({
      where: { id },
      data: { active: false },
    });
    this.logger.log(`SupplierLocation ${id} deactivated`);
  }

  private async assertOwnership(id: string, supplierId: string) {
    const loc = await this.prisma.supplierLocation.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Atrašanās vieta nav atrasta');
    if (loc.supplierId !== supplierId)
      throw new ForbiddenException('Nav atļauts pārvaldīt šo atrašanās vietu');
    return loc;
  }
}

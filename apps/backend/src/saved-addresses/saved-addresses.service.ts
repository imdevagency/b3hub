import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedAddressDto } from './dto/create-saved-address.dto';
import { UpdateSavedAddressDto } from './dto/update-saved-address.dto';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Injectable()
export class SavedAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: RequestingUser) {
    return this.prisma.savedAddress.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateSavedAddressDto, user: RequestingUser) {
    // If marking as default, clear existing default first
    if (dto.isDefault) {
      await this.prisma.savedAddress.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.savedAddress.create({
      data: { ...dto, userId: user.id },
    });
  }

  async update(id: string, dto: UpdateSavedAddressDto, user: RequestingUser) {
    const existing = await this.prisma.savedAddress.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Adrese nav atrasta');
    if (existing.userId !== user.id)
      throw new ForbiddenException('Nav atļauts rediģēt šo adresi');

    if (dto.isDefault) {
      await this.prisma.savedAddress.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.savedAddress.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: RequestingUser) {
    const existing = await this.prisma.savedAddress.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Adrese nav atrasta');
    if (existing.userId !== user.id)
      throw new ForbiddenException('Nav atļauts dzēst šo adresi');
    await this.prisma.savedAddress.delete({ where: { id } });
    return { success: true, id };
  }

  async setDefault(id: string, user: RequestingUser) {
    const existing = await this.prisma.savedAddress.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Adrese nav atrasta');
    if (existing.userId !== user.id)
      throw new ForbiddenException('Nav atļauts mainīt šo adresi');

    await this.prisma.savedAddress.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
    return this.prisma.savedAddress.update({
      where: { id },
      data: { isDefault: true },
    });
  }
}

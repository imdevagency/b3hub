import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: RequestingUser) {
    return this.prisma.savedPaymentMethod.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        label: true,
        cardType: true,
        last4: true,
        expiryMonth: true,
        expiryYear: true,
        isDefault: true,
        createdAt: true,
        // payseraToken intentionally excluded from list response
      },
    });
  }

  async create(dto: CreatePaymentMethodDto, user: RequestingUser) {
    if (dto.isDefault) {
      await this.prisma.savedPaymentMethod.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    const created = await this.prisma.savedPaymentMethod.create({
      data: { ...dto, userId: user.id },
    });
    // Return without the token
    const { payseraToken: _, ...safe } = created;
    return safe;
  }

  async setDefault(id: string, user: RequestingUser) {
    await this._assertOwner(id, user.id);
    await this.prisma.savedPaymentMethod.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
    return this.prisma.savedPaymentMethod.update({
      where: { id },
      data: { isDefault: true },
      select: { id: true, isDefault: true },
    });
  }

  async remove(id: string, user: RequestingUser) {
    await this._assertOwner(id, user.id);
    await this.prisma.savedPaymentMethod.delete({ where: { id } });
    return { success: true, id };
  }

  /**
   * Internal helper — resolve the Paysera token for a saved method.
   * Used by PaymentsService when creating a checkout with a stored card.
   */
  async resolveToken(id: string, userId: string): Promise<string> {
    const method = await this.prisma.savedPaymentMethod.findUnique({
      where: { id },
      select: { userId: true, payseraToken: true },
    });
    if (!method) throw new NotFoundException('Maksājuma metode nav atrasta');
    if (method.userId !== userId) throw new ForbiddenException('Nav atļauts');
    return method.payseraToken;
  }

  private async _assertOwner(id: string, userId: string) {
    const method = await this.prisma.savedPaymentMethod.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!method) throw new NotFoundException('Maksājuma metode nav atrasta');
    if (method.userId !== userId)
      throw new ForbiddenException('Nav atļauts pārvaldīt šo maksājuma metodi');
  }
}

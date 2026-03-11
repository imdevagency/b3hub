import { IsEnum } from 'class-validator';
import { ContainerOrderStatus } from '@prisma/client';

export class UpdateContainerOrderStatusDto {
  @IsEnum(ContainerOrderStatus)
  status: ContainerOrderStatus;
}

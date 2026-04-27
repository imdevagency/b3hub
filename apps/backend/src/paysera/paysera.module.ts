import { Module } from '@nestjs/common';
import { PayseraService } from './paysera.service';

@Module({
  providers: [PayseraService],
  exports: [PayseraService],
})
export class PayseraModule {}

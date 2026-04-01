import { Module } from '@nestjs/common';
import { SavedAddressesService } from './saved-addresses.service';
import { SavedAddressesController } from './saved-addresses.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SavedAddressesController],
  providers: [SavedAddressesService],
})
export class SavedAddressesModule {}

import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { RequireScopeGuard } from '../auth/guards/require-scope.guard';

@Global()
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, JwtAuthGuard, JwtOrApiKeyGuard, RequireScopeGuard],
  exports: [ApiKeysService, JwtOrApiKeyGuard, RequireScopeGuard],
})
export class ApiKeysModule {}

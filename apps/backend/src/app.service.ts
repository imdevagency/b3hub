/**
 * Root service.
 * Returns a minimal status object for the root route.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus(): { status: string; version: string } {
    return { status: 'ok', version: '1' };
  }
}

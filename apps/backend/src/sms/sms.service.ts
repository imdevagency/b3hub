import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS delivery service.
 *
 * In production set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER
 * in the environment. When those vars are absent (dev / CI) the code logs the OTP
 * to the console instead of sending a real SMS.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly twilioClient: {
    messages: { create: (opts: object) => Promise<unknown> };
  } | null = null;

  constructor(private readonly config: ConfigService) {
    const sid = config.get<string>('TWILIO_ACCOUNT_SID');
    const token = config.get<string>('TWILIO_AUTH_TOKEN');

    if (sid && token) {
      // Lazy import so the package is only required when credentials exist.
      // Install with: npm install twilio  (in apps/backend)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Twilio = require('twilio');
        this.twilioClient = new Twilio(sid, token) as typeof this.twilioClient;
        this.logger.log('Twilio SMS client initialised');
      } catch {
        this.logger.warn(
          'twilio package not installed — falling back to dev console mode',
        );
      }
    } else {
      this.logger.warn(
        'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — SMS sent to console (dev mode)',
      );
    }
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const body = `Your B3Hub verification code is: ${code}. Valid for 10 minutes.`;

    if (!this.twilioClient) {
      // Dev mode: print to console so developers can test without real SMS
      this.logger.log(`[DEV] SMS to ${phone}: ${body}`);
      return;
    }

    const from = this.config.get<string>('TWILIO_FROM_NUMBER');
    await this.twilioClient.messages.create({ body, from, to: phone });
    this.logger.log(`SMS OTP sent to ${phone}`);
  }
}

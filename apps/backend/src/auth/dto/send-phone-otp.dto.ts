import { IsString, Matches } from 'class-validator';

/** Request an OTP for phone-based login or registration */
export class SendPhoneOtpDto {
  /**
   * Full E.164 phone number, e.g. "+37120000000"
   * Regex accepts +countryCode followed by 6–14 digits.
   */
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message:
      'phone must be a valid E.164 number (e.g. +37120000000)',
  })
  phone: string;
}

import {
  IsString,
  Matches,
  Length,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

/** Verify phone OTP and obtain session tokens */
export class VerifyPhoneOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be a valid E.164 number (e.g. +37120000000)',
  })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'code must be numeric' })
  code: string;

  /** Required only for first-time (new) users — collected after OTP verification */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName?: string;
}

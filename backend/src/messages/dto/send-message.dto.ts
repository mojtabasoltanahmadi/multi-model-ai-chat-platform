import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Rejects strings that are empty or whitespace-only (e.g. "" or "   "). */
@ValidatorConstraint({ name: 'notBlank', async: false })
export class NotBlankConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    return typeof value === 'string' && value.trim().length > 0;
  }
  defaultMessage(args: ValidationArguments) {
    return `${args.property} نمی‌تواند خالی باشد.`;
  }
}

export class SendMessageDto {
  @IsString({ message: 'پیام باید متن باشد.' })
  @Validate(NotBlankConstraint, { message: 'متن پیام نمی‌تواند خالی یا فقط فاصله باشد.' })
  @MaxLength(4000, { message: 'متن پیام حداکثر ۴۰۰۰ کاراکتر است.' })
  content: string;

  /** Optional: use a specific active model instead of the default one. */
  @IsOptional()
  @IsUUID('4', { message: 'شناسه مدل نامعتبر است.' })
  modelId?: string;

  /**
   * Client-generated idempotency token (≤ 64 chars). Two requests with the
   * same `clientMessageId` for the same conversation reuse the original user
   * row instead of creating a duplicate (refreshing mid-send, double-click,
   * automatic retries).
   */
  @IsOptional()
  @IsString({ message: 'شناسه تکرارناپذیری پیام باید متن باشد.' })
  @MaxLength(64, { message: 'شناسه تکرارناپذیری پیام حداکثر ۶۴ کاراکتر است.' })
  clientMessageId?: string;
}

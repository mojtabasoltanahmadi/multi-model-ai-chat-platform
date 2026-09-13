import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AiProviderKind } from '../ai-model.entity';

export class CreateModelDto {
  @IsString()
  @IsNotEmpty({ message: 'نام مدل الزامی است.' })
  @MaxLength(100, { message: 'نام مدل حداکثر ۱۰۰ کاراکتر است.' })
  name: string;

  @IsIn(['mock', 'openai-compatible'], { message: 'نوع ارائه‌دهنده معتبر نیست.' })
  provider: AiProviderKind;

  @IsString()
  @IsNotEmpty({ message: 'شناسه مدل در سرویس‌دهنده الزامی است.' })
  @MaxLength(200, { message: 'شناسه مدل حداکثر ۲۰۰ کاراکتر است.' })
  externalModelId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'آدرس پایه حداکثر ۵۰۰ کاراکتر است.' })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'کلید API حداکثر ۵۰۰ کاراکتر است.' })
  apiKey?: string;

  @IsOptional()
  @IsBoolean({ message: 'وضعیت فعال باید true یا false باشد.' })
  isActive?: boolean;
}

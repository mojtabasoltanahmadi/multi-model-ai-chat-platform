import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString({ message: 'عنوان باید متن باشد.' })
  @MinLength(1, { message: 'عنوان نمی‌تواند خالی باشد.' })
  @MaxLength(200, { message: 'عنوان حداکثر ۲۰۰ کاراکتر است.' })
  title?: string;
}

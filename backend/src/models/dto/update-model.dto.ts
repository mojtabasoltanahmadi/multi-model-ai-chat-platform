import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AiProviderKind } from '../ai-model.entity';

/** Partial update; unknown fields are stripped by the global ValidationPipe. */
export class UpdateModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(['mock', 'openai-compatible'])
  provider?: AiProviderKind;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalModelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;
}

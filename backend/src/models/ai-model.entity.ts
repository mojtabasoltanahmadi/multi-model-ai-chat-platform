import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Supported provider kinds. The MVP ships two adapters:
 * - mock: streams a canned response (demo & tests, no external dependency)
 * - openai-compatible: any OpenAI-compatible /chat/completions streaming API
 */
export type AiProviderKind = 'mock' | 'openai-compatible';

@Entity('ai_models')
export class AiModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 40 })
  provider: AiProviderKind;

  /** Model identifier at the provider, e.g. "gpt-4o-mini" (ignored by mock). */
  @Column({ name: 'external_model_id', type: 'varchar', length: 200 })
  externalModelId: string;

  /** Optional OpenAI-compatible base URL, e.g. https://api.openai.com/v1 */
  @Column({ name: 'base_url', type: 'varchar', length: 500, nullable: true })
  baseUrl: string | null;

  /** Provider API key. Never returned to clients. */
  @Column({ name: 'api_key', type: 'varchar', length: 500, nullable: true })
  apiKey: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

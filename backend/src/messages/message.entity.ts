import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from '../conversations/conversation.entity';
import { AiModel } from '../models/ai-model.entity';

export type MessageRole = 'user' | 'assistant';

/**
 * Status of an assistant message:
 * - completed: full AI response was received
 * - error: AI failed mid-stream; content holds the partial response (may be empty)
 */
export type MessageStatus = 'completed' | 'error';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ type: 'varchar', length: 20 })
  role: MessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  status: MessageStatus | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Index()
  @Column({ name: 'model_id', type: 'uuid', nullable: true })
  modelId: string | null;

  @ManyToOne(() => AiModel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'model_id' })
  model: AiModel | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

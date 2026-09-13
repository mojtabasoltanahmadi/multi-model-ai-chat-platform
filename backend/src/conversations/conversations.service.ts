import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { Message } from '../messages/message.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
  ) {}

  listForUser(userId: string): Promise<Conversation[]> {
    return this.conversationsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  create(userId: string, dto: CreateConversationDto): Promise<Conversation> {
    const conversation = this.conversationsRepository.create({
      userId,
      title: dto.title?.trim() || 'گفتگوی جدید',
    });
    return this.conversationsRepository.save(conversation);
  }

  /**
   * Returns a conversation only if it belongs to the given user.
   * Ownership is part of the lookup, never a post-check.
   */
  async getOwned(userId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId, userId },
    });
    if (!conversation) {
      throw new NotFoundException('گفتگو پیدا نشد.');
    }
    return conversation;
  }

  /** Conversation with its messages, owned by the given user. */
  async getOwnedWithMessages(userId: string, conversationId: string) {
    const conversation = await this.getOwned(userId, conversationId);
    const messages = await this.conversationsRepository.manager
      .getRepository(Message)
      .find({
        where: { conversationId: conversation.id },
        order: { createdAt: 'ASC' },
      });
    return { conversation, messages };
  }

  async renameTitle(conversation: Conversation, title: string): Promise<void> {
    await this.conversationsRepository.update(conversation.id, {
      title: title.slice(0, 200),
    });
  }
}

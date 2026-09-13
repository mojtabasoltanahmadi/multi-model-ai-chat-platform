import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageStatus } from './message.entity';
import { ConversationsService } from '../conversations/conversations.service';
import { ModelsService } from '../models/models.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { AiModel } from '../models/ai-model.entity';

export interface ChatStreamCallbacks {
  onMeta(userMessage: Message, model: AiModel): void;
  onDelta(text: string): void;
  onDone(assistantMessage: Message): void;
  onError(clientMessage: string): void;
}

const NEW_CONVERSATION_TITLE = 'گفتگوی جدید';
const TITLE_MAX_LENGTH = 60;

/**
 * Orchestrates one chat turn:
 *   validate → persist user message → stream AI deltas → persist ONE assistant message.
 * Whatever happens (success, AI error, client disconnect), exactly one
 * assistant message row is created and its status tells success from failure.
 */
@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly conversationsService: ConversationsService,
    private readonly modelsService: ModelsService,
    private readonly aiProviderService: AiProviderService,
  ) {}

  /** Loads a user's conversation including its messages. */
  getConversationWithMessages(userId: string, conversationId: string) {
    return this.conversationsService.getOwnedWithMessages(userId, conversationId);
  }

  /**
   * Pre-flight for a chat turn: throws the proper HTTP error (404/400) if the
   * conversation is unknown/not owned or the model is invalid/inactive.
   * Runs before the SSE response starts, so errors reach the client as JSON.
   */
  async assertChatTurnAllowed(
    userId: string,
    conversationId: string,
    modelId?: string,
  ): Promise<void> {
    await this.conversationsService.getOwned(userId, conversationId);
    await this.modelsService.resolveChatModel(modelId);
  }

  async streamChatTurn(
    userId: string,
    conversationId: string,
    content: string,
    modelId: string | undefined,
    isClientDisconnected: () => boolean,
    callbacks: ChatStreamCallbacks,
  ): Promise<void> {
    const { conversation, messages } =
      await this.conversationsService.getOwnedWithMessages(userId, conversationId);

    const model = await this.modelsService.resolveChatModel(modelId);

    const userMessage = await this.messagesRepository.save(
      this.messagesRepository.create({
        conversationId: conversation.id,
        role: 'user',
        content,
      }),
    );

    // First message names the conversation.
    if (messages.length === 0 && conversation.title === NEW_CONVERSATION_TITLE) {
      conversation.title = content.trim().slice(0, TITLE_MAX_LENGTH);
      await this.conversationsService.renameTitle(conversation, conversation.title);
    }

    callbacks.onMeta(userMessage, model);

    // Provider chat history from persisted messages plus the new user message.
    const history = [
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user' as const, content },
    ];

    // One assistant row per turn; status distinguishes success from failure.
    const assistantMessage = this.messagesRepository.create({
      conversationId: conversation.id,
      role: 'assistant',
      content: '',
      status: 'completed' as MessageStatus,
      errorMessage: null,
      modelId: model.id,
    });

    try {
      for await (const delta of this.aiProviderService.streamChat(history, model)) {
        if (isClientDisconnected()) {
          assistantMessage.status = 'error';
          assistantMessage.errorMessage = 'Client disconnected before completion.';
          break;
        }
        assistantMessage.content += delta;
        callbacks.onDelta(delta);
      }

      if (assistantMessage.status === 'completed') {
        callbacks.onDone(await this.messagesRepository.save(assistantMessage));
        return;
      }
      // Client disconnected: persist the partial content, no further events.
      await this.messagesRepository.save(assistantMessage);
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      this.logger.error(
        `AI stream failed for conversation ${conversation.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      assistantMessage.status = 'error';
      assistantMessage.errorMessage = isAbort
        ? 'AI request timed out.'
        : error instanceof Error
          ? error.message
          : String(error);
      await this.messagesRepository.save(assistantMessage);
      // Generic, safe message for the client - provider details stay in logs.
      callbacks.onError(
        isAbort
          ? 'پاسخ هوش مصنوعی بیش از حد طول کشید. لطفاً دوباره تلاش کنید.'
          : 'سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.',
      );
    }
  }
}

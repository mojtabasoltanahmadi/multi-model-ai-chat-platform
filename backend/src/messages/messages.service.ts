import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageStatus } from './message.entity';
import { ConversationsService } from '../conversations/conversations.service';
import { ModelsService } from '../models/models.service';
import { AiProviderService } from '../ai/ai-provider.service';
import { AiModel } from '../models/ai-model.entity';

export interface ChatStreamCallbacks {
  /**
   * Emitted once before any delta. `userMessage` is the persisted user row
   * (existing or freshly created). `assistantMessage` is the pre-persisted
   * assistant row in status='pending'. `replay` is true when this request is
   * recognized as a retry of a previous one (same clientMessageId) — the user
   * row already existed, no duplicate was created, and the latest assistant
   * turn for that user row is incomplete (interrupted / failed / pending);
   * the frontend should offer Retry instead of treating this as a new turn.
   */
  onMeta: (
    userMessage: Message,
    assistantMessage: Message,
    model: AiModel,
    replay: boolean,
  ) => void;
  onDelta(text: string): void;
  onDone(assistantMessage: Message): void;
  onError(clientMessage: string): void;
}

const NEW_CONVERSATION_TITLE = 'گفتگوی جدید';
const TITLE_MAX_LENGTH = 60;

/**
 * Orchestrates one chat turn. The data flow is:
 *
 *   1. validate ownership + model
 *   2. resolve user row (reuse by clientMessageId, else create)
 *   3. create a NEW assistant row with status='pending' (pre-persist so a
 *      reload always finds it; one-row-per-turn invariant is preserved by
 *      creating exactly one)
 *   4. SSE `meta` → 5. AI stream
 *      • first delta flips assistant.status to 'streaming'
 *      • completion → assistant.status='completed'
 *      • client disconnect → assistant.status='interrupted' (no error event)
 *      • AI failure / timeout → assistant.status='failed'  (error event)
 *
 * Whatever happens, exactly one user row + one fresh assistant row are
 * persisted per turn. Refreshing mid-stream reads the persisted state — it
 * never re-invokes the AI.
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
   * conversation is unknown/not owned, the model is invalid/inactive, or the
   * idempotency key collides with a different message body. Runs before the
   * SSE response starts, so errors reach the client as JSON.
   */
  async assertChatTurnAllowed(
    userId: string,
    conversationId: string,
    modelId?: string,
    idempotency?: { clientMessageId?: string; content: string },
  ): Promise<void> {
    await this.conversationsService.getOwned(userId, conversationId);
    await this.modelsService.resolveChatModel(modelId, 'free');

    if (idempotency?.clientMessageId) {
      const existing = await this.messagesRepository.findOne({
        where: {
          conversationId,
          role: 'user',
          clientMessageId: idempotency.clientMessageId,
        },
      });
      if (existing && existing.content !== idempotency.content) {
        // Same intent id but different text — most likely a client bug.
        // Caught here (before the SSE headers are flushed) so the client
        // gets a normal HTTP 400, not an opaque SSE error mid-stream.
        throw new BadRequestException(
          'این پیام قبلاً با متن دیگری ارسال شده است.',
        );
      }
    }
  }

  /**
   * Returns the user row for a retry (same clientMessageId) if one exists in
   * this conversation. Also returns whether the latest assistant turn for
   * that user row is still incomplete (so the UI can offer Retry instead of
   * starting a brand-new stream).
   */
  async findReplayableUserMessage(
    conversationId: string,
    clientMessageId: string,
  ): Promise<{ userMessage: Message; hasIncompleteAssistant: boolean } | null> {
    if (!clientMessageId) return null;

    const userMessage = await this.messagesRepository.findOne({
      where: {
        conversationId,
        role: 'user',
        clientMessageId,
      },
    });
    if (!userMessage) return null;

    const latestAssistant = await this.messagesRepository.findOne({
      where: { conversationId, role: 'assistant' },
      order: { createdAt: 'DESC' },
    });
    const hasIncompleteAssistant =
      latestAssistant !== null &&
      latestAssistant.createdAt > userMessage.createdAt &&
      (latestAssistant.status === 'pending' ||
        latestAssistant.status === 'streaming' ||
        latestAssistant.status === 'interrupted' ||
        latestAssistant.status === 'failed');

    return { userMessage, hasIncompleteAssistant };
  }

  async streamChatTurn(
    userId: string,
    conversationId: string,
    content: string,
    modelId: string | undefined,
    clientMessageId: string | undefined,
    isClientDisconnected: () => boolean,
    callbacks: ChatStreamCallbacks,
  ): Promise<void> {
    const { conversation, messages } =
      await this.conversationsService.getOwnedWithMessages(userId, conversationId);

    const model = await this.modelsService.resolveChatModel(modelId, 'free');

    // ---- Idempotency: reuse the original user row if this is a retry. ----
    // Content-collision with the same clientMessageId was already rejected
    // by assertChatTurnAllowed; if we still find a match here, its content
    // matches and this is a genuine replay.
    let userMessage: Message;
    let replay = false;
    if (clientMessageId) {
      const replayMatch = await this.messagesRepository.findOne({
        where: {
          conversationId: conversation.id,
          role: 'user',
          clientMessageId,
        },
      });
      if (replayMatch) {
        userMessage = replayMatch;
        replay = true;
      } else {
        userMessage = await this.messagesRepository.save(
          this.messagesRepository.create({
            conversationId: conversation.id,
            role: 'user',
            content,
            clientMessageId,
          }),
        );
      }
    } else {
      userMessage = await this.messagesRepository.save(
        this.messagesRepository.create({
          conversationId: conversation.id,
          role: 'user',
          content,
        }),
      );
    }

    // First message names the conversation (only on a freshly created user
    // row — never on a retry, which would silently erase the user's title).
    if (!replay && messages.length === 0 && conversation.title === NEW_CONVERSATION_TITLE) {
      conversation.title = content.trim().slice(0, TITLE_MAX_LENGTH);
      await this.conversationsService.renameTitle(conversation, conversation.title);
    }

    // Pre-persist the assistant row so a reload mid-stream always finds it.
    const assistantMessage = await this.messagesRepository.save(
      this.messagesRepository.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: '',
        status: 'pending' as MessageStatus,
        errorMessage: null,
        modelId: model.id,
      }),
    );

    callbacks.onMeta(userMessage, { ...assistantMessage }, model, replay);

    // Build the provider history from everything persisted up to and
    // including the user row just resolved above.
    const history = [
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user' as const, content: userMessage.content },
    ];

    let streamingFlipped = false;

    try {
      for await (const delta of this.aiProviderService.streamChat(history, model)) {
        if (isClientDisconnected()) {
          // The user closed the tab / hit Stop. Persist whatever arrived
          // with status='interrupted' and stop emitting events — nothing
          // more can be delivered.
          assistantMessage.status = 'interrupted';
          assistantMessage.errorMessage = 'Client disconnected before completion.';
          await this.messagesRepository.save(assistantMessage);
          return;
        }
        assistantMessage.content += delta;
        if (!streamingFlipped) {
          assistantMessage.status = 'streaming';
          streamingFlipped = true;
        }
        // Throttle the DB write while content accumulates. 'streaming' +
        // 'content' is enough to show a live update; we still batch it and
        // flush at completion/interruption for efficiency. The in-memory
        // accumulator is the live truth for the SSE deltas in flight.
        callbacks.onDelta(delta);
      }

      // If the client bails out before the first delta arrives, the loop
      // body never executes and we'd otherwise persist status='completed'
      // for a partial response the user never saw. Check again at the end
      // so a disconnect-at-zero-bytes still surfaces as 'interrupted'.
      if (isClientDisconnected()) {
        assistantMessage.status = 'interrupted';
        assistantMessage.errorMessage = 'Client disconnected before completion.';
        await this.messagesRepository.save(assistantMessage);
        return;
      }

      assistantMessage.status = 'completed';
      const saved = await this.messagesRepository.save(assistantMessage);
      callbacks.onDone(saved);
    } catch (error) {
      // Two distinct abort paths share the AbortError class — disambiguate
      // by checking whether the client is still connected:
      //   - client gone → status='interrupted' (no error event, the
      //     disconnector couldn't receive it anyway)
      //   - server-side timeout → status='failed' with a generic message
      if (isClientDisconnected()) {
        assistantMessage.status = 'interrupted';
        assistantMessage.errorMessage = 'Client disconnected before completion.';
        await this.messagesRepository.save(assistantMessage);
        return;
      }
      const isAbort = error instanceof Error && error.name === 'AbortError';
      this.logger.error(
        `AI stream failed for conversation ${conversation.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      assistantMessage.status = 'failed';
      assistantMessage.errorMessage = isAbort
        ? 'AI request timed out.'
        : error instanceof Error
          ? error.message
          : String(error);
      await this.messagesRepository.save(assistantMessage);
      callbacks.onError(
        isAbort
          ? 'پاسخ هوش مصنوعی بیش از حد طول کشید. لطفاً دوباره تلاش کنید.'
          : 'سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.',
      );
    }
  }
}

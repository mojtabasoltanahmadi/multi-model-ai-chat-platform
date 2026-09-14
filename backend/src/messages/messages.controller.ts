import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * Sends a message and streams the AI answer back as Server-Sent Events.
 *
 * Event sequence (per chat turn):
 *   meta  → { userMessage, assistantMessage (status='pending'), model, replay }
 *           `assistantMessage.id` is the real, persisted id from the start —
 *           a reload can already address it.
 *   delta → one AI text chunk (repeated). The first delta implies the server
 *           has flipped the assistant row to status='streaming'.
 *   done  → final, persisted assistant message (status='completed').
 *   error → generic failure message; a partial assistant message with
 *           status='failed' has been persisted exactly once.
 *
 * Client-side disconnect: no further events are emitted; the assistant row
 * is persisted with status='interrupted' (partial content kept).
 *
 * Idempotency: if `clientMessageId` is supplied and matches an existing
 * user row in this conversation, the user row is reused (no duplicate) and
 * `meta.replay = true` is emitted. The assistant row is always new.
 */
@Controller('conversations')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post(':conversationId/messages')
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    // Validate ownership and model availability BEFORE opening the SSE stream,
    // so these errors reach the client as normal JSON errors.
    await this.messagesService.assertChatTurnAllowed(user.id, conversationId, dto.modelId);

    // Idempotency-Key header mirrors clientMessageId (defense-in-depth: lets
    // proxies / future replay logs correlate without parsing the body).
    const clientMessageId =
      dto.clientMessageId ??
      (typeof request.headers['idempotency-key'] === 'string'
        ? request.headers['idempotency-key']
        : undefined);

    // Nest defaults POST to 201; an SSE stream is a normal 200 response.
    response.status(HttpStatus.OK);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    // response.destroyed becomes true when the client disconnects;
    // writableEnded when we finished the stream ourselves.
    const isClientDisconnected = () => response.writableEnded || response.destroyed;

    try {
      await this.messagesService.streamChatTurn(
        user.id,
        conversationId,
        dto.content.trim(),
        dto.modelId,
        clientMessageId,
        isClientDisconnected,
        {
          onMeta: (userMessage, assistantMessage, model, replay) => {
            this.writeEvent(response, 'meta', {
              userMessage: this.serializeMessage(userMessage),
              assistantMessage: this.serializeMessage(assistantMessage),
              model: { id: model.id, name: model.name, provider: model.provider },
              replay,
            });
          },
          onDelta: (text) => this.writeEvent(response, 'delta', { text }),
          onDone: (assistantMessage) => {
            this.writeEvent(response, 'done', {
              assistantMessage: this.serializeMessage(assistantMessage),
            });
            response.end();
          },
          onError: (clientMessage) => {
            this.writeEvent(response, 'error', {
              message: clientMessage,
            });
            response.end();
          },
        },
      );
    } catch (error) {
      // Ownership/validation failures happen before any event is written,
      // so a normal HTTP error response is still possible here.
      if (!response.writableEnded && !response.headersSent) {
        throw error;
      }
      if (!response.writableEnded) {
        this.writeEvent(response, 'error', {
          message: 'سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً دوباره تلاش کنید.',
        });
        response.end();
      }
    }
  }

  private writeEvent(response: Response, event: string, data: unknown) {
    if (response.destroyed || response.writableEnded) return;
    response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private serializeMessage(message: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    status: string | null;
    errorMessage: string | null;
    modelId: string | null;
    clientMessageId: string | null;
    createdAt: Date;
  }) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      status: message.status,
      errorMessage: message.errorMessage,
      // Per-turn model attribution: the client can show which model produced
      // each assistant response, including after a mid-conversation switch.
      modelId: message.modelId,
      // Idempotency token echoed back; frontend can correlate retries with
      // the original user intent and link Retry buttons to the right turn.
      clientMessageId: message.clientMessageId,
      createdAt: message.createdAt,
    };
  }
}

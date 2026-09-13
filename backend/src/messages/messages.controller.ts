import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * Sends a message and streams the AI answer back as Server-Sent Events.
 *
 * Event sequence:
 *   meta  -> persisted user message + resolved model
 *   delta -> one AI text chunk (repeated)
 *   done  -> final, persisted assistant message (status: "completed")
 *   error -> generic failure message; a partial assistant message with
 *            status "error" has still been persisted exactly once
 */
@Controller('conversations')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post(':conversationId/messages')
  async sendMessage(
    @CurrentUser() user: { id: string },
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
    @Res() response: Response,
  ): Promise<void> {
    // Validate ownership and model availability BEFORE opening the SSE stream,
    // so these errors reach the client as normal JSON HTTP errors.
    await this.messagesService.assertChatTurnAllowed(user.id, conversationId, dto.modelId);

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
        isClientDisconnected,
        {
          onMeta: (userMessage, model) => {
            this.writeEvent(response, 'meta', {
              userMessage: this.serializeMessage(userMessage),
              model: { id: model.id, name: model.name, provider: model.provider },
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
            this.writeEvent(response, 'error', { message: clientMessage });
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
    createdAt: Date;
  }) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      status: message.status,
      errorMessage: message.errorMessage,
      createdAt: message.createdAt,
    };
  }
}

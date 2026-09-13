import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModel } from '../models/ai-model.entity';

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const MOCK_RESPONSE = [
  'سلام! این یک پاسخ آزمایشی از مدل ماک (Mock) است. ',
  'پلتفرم درست کار می‌کند و پیام شما با موفقیت دریافت شد. ',
  'برای استفاده از یک مدل واقعی، مدیر سیستم می‌تواند از پنل مدیریت ',
  'یک مدل با نوع «openai-compatible» و کلید API معتبر بسازد.',
].join('');

/**
 * Single, small provider abstraction for the MVP.
 * streamChat yields text deltas for the given history and model config.
 */
@Injectable()
export class AiProviderService implements OnModuleDestroy {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly activeControllers = new Set<AbortController>();

  constructor(private readonly configService: ConfigService) {}

  async *streamChat(
    history: ChatHistoryItem[],
    model: AiModel,
  ): AsyncGenerator<string> {
    switch (model.provider) {
      case 'mock':
        yield* this.streamMock();
        return;
      case 'openai-compatible':
        yield* this.streamOpenAiCompatible(history, model);
        return;
      default:
        // Unreachable unless a bad provider value got into the database.
        throw new Error(`Unknown AI provider: ${model.provider}`);
    }
  }

  private async *streamMock(): AsyncGenerator<string> {
    // Small delay between chunks so streaming is visible in the UI.
    const chunks = MOCK_RESPONSE.match(/\S+\s*/g) ?? [MOCK_RESPONSE];
    for (const chunk of chunks) {
      await sleep(40);
      yield chunk;
    }
  }

  private async *streamOpenAiCompatible(
    history: ChatHistoryItem[],
    model: AiModel,
  ): AsyncGenerator<string> {
    if (!model.apiKey) {
      throw new Error(`Model "${model.name}" has no API key configured.`);
    }
    const baseUrl = (model.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    const timeoutMs = this.configService.get<number>('ai.requestTimeoutMs') ?? 60000;

    const controller = new AbortController();
    this.activeControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify({
          model: model.externalModelId,
          messages: history,
          stream: true,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      this.activeControllers.delete(controller);
    }

    if (!response.ok || !response.body) {
      const detail = await safeReadBody(response);
      this.logger.error(
        `AI provider returned ${response.status} for model ${model.name}: ${detail}`,
      );
      throw new Error(`AI provider error (HTTP ${response.status}).`);
    }

    // Parse the SSE stream from the provider: lines of "data: {...}".
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex: number;
        while ((separatorIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, separatorIndex).trim();
          buffer = buffer.slice(separatorIndex + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice('data:'.length).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Ignore malformed keep-alive lines; do not crash the stream.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  onModuleDestroy() {
    // Release in-flight provider calls on shutdown.
    for (const controller of this.activeControllers) controller.abort();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '<unreadable>';
  }
}

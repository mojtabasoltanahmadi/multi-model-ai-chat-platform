import { MessagesService } from './messages.service';
import { createMockRepository } from '../test/mocks';

describe('MessagesService.streamChatTurn', () => {
  let service: MessagesService;
  let messagesRepository: ReturnType<typeof createMockRepository>;
  let conversationsService: { getOwnedWithMessages: jest.Mock; renameTitle: jest.Mock };
  let modelsService: { resolveChatModel: jest.Mock };
  let aiProviderService: { streamChat: jest.Mock };

  const setup = ({
    history = [],
    title = 'گفتگوی جدید',
  }: {
    history?: { role: 'user' | 'assistant'; content: string }[];
    title?: string;
  } = {}) => {
    conversationsService = {
      getOwnedWithMessages: jest.fn().mockResolvedValue({
        conversation: { id: 'conv-1', userId: 'user-1', title },
        messages: history,
      }),
      renameTitle: jest.fn().mockResolvedValue(undefined),
    };
    modelsService = {
      resolveChatModel: jest.fn().mockResolvedValue({ id: 'model-1', name: 'Mock', provider: 'mock' }),
    };
    messagesRepository = createMockRepository();
    service = new MessagesService(
      messagesRepository as any,
      conversationsService as any,
      modelsService as any,
      aiProviderService as any,
    );
  };

  const callbacks = () => ({
    onMeta: jest.fn(),
    onDelta: jest.fn(),
    onDone: jest.fn(),
    onError: jest.fn(),
  });

  beforeEach(() => {
    aiProviderService = { streamChat: jest.fn() };
  });

  it('persists exactly ONE assistant message with completed status on success', async () => {
    setup();
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'سلام ';
      yield 'دنیا';
    });
    const cb = callbacks();

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, () => false, cb);

    const saved = messagesRepository.save.mock.calls.map((call) => call[0]);
    const assistantRows = saved.filter((row) => row.role === 'assistant');
    expect(assistantRows).toHaveLength(1);
    expect(assistantRows[0]).toMatchObject({
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'سلام دنیا',
      status: 'completed',
      modelId: 'model-1',
    });
    expect(cb.onDone).toHaveBeenCalledTimes(1);
    expect(cb.onError).not.toHaveBeenCalled();
    // both messages are tied to the same conversation (ownership chain)
    expect(saved[0]).toMatchObject({ role: 'user', conversationId: 'conv-1' });
  });

  it('persists exactly ONE assistant message with error status and a generic message on AI failure', async () => {
    setup();
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'پاسخ ناتمام';
      throw new Error('ECONNREFUSED 10.0.0.9:443 (internal detail)');
    });
    const cb = callbacks();

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, () => false, cb);

    const savedAssistant = messagesRepository.save.mock.calls
      .map((call) => call[0])
      .filter((row) => row.role === 'assistant');
    expect(savedAssistant).toHaveLength(1);
    expect(savedAssistant[0]).toMatchObject({ status: 'error', content: 'پاسخ ناتمام' });
    expect(savedAssistant[0].errorMessage).toContain('ECONNREFUSED');
    expect(cb.onError).toHaveBeenCalledTimes(1);
    // the client must never see provider internals
    expect(cb.onError.mock.calls[0][0]).not.toContain('ECONNREFUSED');
    expect(cb.onDone).not.toHaveBeenCalled();
  });

  it('persists a distinguishable partial message when the client disconnects', async () => {
    setup();
    let disconnected = false;
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'قسمت اول ';
      disconnected = true; // simulate the client vanishing mid-stream
      yield 'قسمت دومی که به کلاینت نمی‌رسد';
    });
    const cb = callbacks();

    await service.streamChatTurn(
      'user-1',
      'conv-1',
      'سلام',
      undefined,
      () => disconnected,
      cb,
    );

    const savedAssistant = messagesRepository.save.mock.calls
      .map((call) => call[0])
      .filter((row) => row.role === 'assistant');
    expect(savedAssistant).toHaveLength(1);
    expect(savedAssistant[0].status).toBe('error');
    expect(cb.onDelta).toHaveBeenCalledTimes(1); // only chunks sent before disconnect
    expect(cb.onDone).not.toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled(); // nothing more can be delivered
  });

  it('names the conversation after its first message', async () => {
    setup({ title: 'گفتگوی جدید' });
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'ok';
    });

    await service.streamChatTurn(
      'user-1',
      'conv-1',
      'یک پیام نسبتاً طولانی به عنوان اولین پیام',
      undefined,
      () => false,
      callbacks(),
    );

    expect(conversationsService.renameTitle).toHaveBeenCalledWith(
      expect.anything(),
      'یک پیام نسبتاً طولانی به عنوان اولین پیام',
    );
  });

  it('does not rename a conversation that already has a custom title', async () => {
    setup({ title: 'عنوان دلخواه' });
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'ok';
    });

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, () => false, callbacks());

    expect(conversationsService.renameTitle).not.toHaveBeenCalled();
  });

  it('includes the persisted history plus the new message in the provider request', async () => {
    setup({
      history: [
        { role: 'user', content: 'قبلی' },
        { role: 'assistant', content: 'پاسخ قبلی' },
      ],
    });
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'ok';
    });

    await service.streamChatTurn('user-1', 'conv-1', 'جدید', undefined, () => false, callbacks());

    const history = aiProviderService.streamChat.mock.calls[0][0];
    expect(history).toEqual([
      { role: 'user', content: 'قبلی' },
      { role: 'assistant', content: 'پاسخ قبلی' },
      { role: 'user', content: 'جدید' },
    ]);
  });
});

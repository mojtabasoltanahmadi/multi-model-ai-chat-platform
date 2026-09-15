import { BadRequestException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { createMockRepository } from '../test/mocks';

describe('MessagesService.streamChatTurn', () => {
  let service: MessagesService;
  let messagesRepository: ReturnType<typeof createMockRepository>;
  let conversationsService: {
    getOwned: jest.Mock;
    getOwnedWithMessages: jest.Mock;
    renameTitle: jest.Mock;
  };
  let modelsService: { resolveChatModel: jest.Mock };
  let aiProviderService: { streamChat: jest.Mock };

  const setup = ({
    history = [],
    title = 'گفتگوی جدید',
    existingUserByClientMid = null,
  }: {
    history?: { role: 'user' | 'assistant'; content: string }[];
    title?: string;
    existingUserByClientMid?: { id: string; content: string } | null;
  } = {}) => {
    conversationsService = {
      getOwned: jest.fn().mockResolvedValue({ id: 'conv-1', userId: 'user-1', title }),
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

    if (existingUserByClientMid) {
      messagesRepository.findOne.mockImplementation(async (options: any) => {
        if (
          options?.where?.role === 'user' &&
          options?.where?.clientMessageId === existingUserByClientMid.id
        ) {
          return {
            id: 'user-existing',
            conversationId: 'conv-1',
            role: 'user',
            content: existingUserByClientMid.content,
            clientMessageId: existingUserByClientMid.id,
          };
        }
        return null;
      });
    }

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

  it('pre-persists an assistant row with status=pending BEFORE any chunk and emits it in meta', async () => {
    setup();
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'سلام ';
      yield 'دنیا';
    });
    const cb = callbacks();

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, undefined, () => false, cb);

    // The mock's `saved[]` history holds every snapshot as it was at save
    // time — what was actually written to the DB in order.
    const assistantRows = messagesRepository.saved.filter(
      (row: any) => row.role === 'assistant',
    );
    // The "one-row-per-turn" invariant is about UNIQUE rows, not save() calls:
    // a successful turn saves the assistant row twice (pending, then completed).
    const distinctAssistantIds = new Set(assistantRows.map((row: any) => row.id));
    expect(distinctAssistantIds.size).toBe(1);
    // The first snapshot (pre-stream) is in status 'pending'.
    expect(assistantRows[0]).toMatchObject({
      conversationId: 'conv-1',
      role: 'assistant',
      content: '',
      status: 'pending',
      modelId: 'model-1',
    });
    // onMeta carries the real assistant message id (not a streaming placeholder).
    expect(cb.onMeta).toHaveBeenCalledTimes(1);
    const metaArg = cb.onMeta.mock.calls[0];
    expect(metaArg[0]).toMatchObject({ role: 'user', content: 'سلام' });
    expect(metaArg[1]).toMatchObject({ status: 'pending' });
    expect(metaArg[2]).toMatchObject({ id: 'model-1' });
    expect(metaArg[3]).toBe(false); // not a replay
  });

  it('persists exactly ONE assistant message with completed status on success', async () => {
    setup();
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'سلام ';
      yield 'دنیا';
    });
    const cb = callbacks();

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, undefined, () => false, cb);

    const assistantRows = messagesRepository.saved.filter(
      (row: any) => row.role === 'assistant',
    );
    const distinctIds = new Set(assistantRows.map((row: any) => row.id));
    expect(distinctIds.size).toBe(1);
    // The last saved snapshot has the final status.
    expect(assistantRows.at(-1)).toMatchObject({
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'سلام دنیا',
      status: 'completed',
      modelId: 'model-1',
    });
    expect(cb.onDone).toHaveBeenCalledTimes(1);
    expect(cb.onError).not.toHaveBeenCalled();
    const userSaves = messagesRepository.saved.filter((row: any) => row.role === 'user');
    expect(userSaves).toHaveLength(1);
    expect(userSaves[0]).toMatchObject({ role: 'user', conversationId: 'conv-1' });
  });

  it('persists exactly ONE assistant message with failed status and a generic message on AI failure', async () => {
    setup();
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'پاسخ ناتمام';
      throw new Error('ECONNREFUSED 10.0.0.9:443 (internal detail)');
    });
    const cb = callbacks();

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, undefined, () => false, cb);

    const savedAssistantFinal = messagesRepository.saved
      .filter((row) => row.role === 'assistant')
      .at(-1);
    expect(savedAssistantFinal).toMatchObject({ status: 'failed', content: 'پاسخ ناتمام' });
    expect(savedAssistantFinal.errorMessage).toContain('ECONNREFUSED');
    expect(cb.onError).toHaveBeenCalledTimes(1);
    // the client must never see provider internals
    expect(cb.onError.mock.calls[0][0]).not.toContain('ECONNREFUSED');
    expect(cb.onDone).not.toHaveBeenCalled();
  });

  it('persists a distinguishable interrupted partial message (NO error event) when the client disconnects', async () => {
    setup();
    let disconnected = false;
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'قسمت اول ';
      disconnected = true;
      yield 'قسمت دومی که به کلاینت نمی‌رسد';
    });
    const cb = callbacks();

    await service.streamChatTurn(
      'user-1',
      'conv-1',
      'سلام',
      undefined,
      undefined,
      () => disconnected,
      cb,
    );

    const savedAssistantFinal = messagesRepository.saved
      .filter((row: any) => row.role === 'assistant')
      .at(-1);
    // The semantic distinction: client-disconnect is 'interrupted', NOT
    // 'failed' — and crucially, no error event is emitted because the
    // disconnector cannot receive it anyway.
    expect(savedAssistantFinal.status).toBe('interrupted');
    expect(savedAssistantFinal.content).toBe('قسمت اول ');
    expect(cb.onDelta).toHaveBeenCalledTimes(1);
    expect(cb.onDone).not.toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('marks the row interrupted when the client bails out BEFORE any delta arrives', async () => {
    // Real-world scenario: user hits Send, then immediately closes the tab.
    // The provider may not have produced any bytes yet, so the for-await
    // body never executes — we still need to persist something better than
    // a 'pending' row that never gets a 'completed' update.
    setup();
    let disconnected = true;
    aiProviderService.streamChat.mockImplementation(async function* () {
      // First yield happens after we've already declared the client gone.
      yield 'late answer nobody saw';
    });
    const cb = callbacks();

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, undefined, () => disconnected, cb);

    const savedAssistantFinal = messagesRepository.saved
      .filter((row: any) => row.role === 'assistant')
      .at(-1);
    expect(savedAssistantFinal.status).toBe('interrupted');
    // The post-loop disconnect check fires even though the body never ran.
    // No deltas were actually delivered to the client, so the content may
    // be empty.
    expect(cb.onDelta).not.toHaveBeenCalled();
    expect(cb.onDone).not.toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('marks the row interrupted (not failed) when the stream throws AbortError AFTER the client disconnected', async () => {
    // Real-world: the client has already gone away, and the provider's read
    // subsequently throws AbortError. Without the disambiguation, this would
    // be classified as 'failed' — same status as a provider outage, which
    // is wrong: the client simply missed the rest.
    setup();
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'قسمت اول';
      // Simulate the read throwing because the underlying fetch was aborted.
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    const cb = callbacks();

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, undefined, () => true, cb);

    const savedAssistantFinal = messagesRepository.saved
      .filter((row: any) => row.role === 'assistant')
      .at(-1);
    expect(savedAssistantFinal.status).toBe('interrupted');
    expect(cb.onError).not.toHaveBeenCalled();
    expect(cb.onDone).not.toHaveBeenCalled();
  });

  it('flips the assistant row to status=streaming on the first delta', async () => {
    setup();
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'یک';
      yield 'دو';
      yield 'سه';
    });
    const cb = callbacks();

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, undefined, () => false, cb);

    // We expect at least two saves for the assistant row:
    //   1. pre-persist (status='pending')
    //   2. final save after stream (status='completed')
    // The transition to 'streaming' happens in memory (and the user sees it
    // in SSE deltas); it does not require an extra DB round-trip per chunk.
    const assistantSaves = messagesRepository.saved.filter(
      (row: any) => row.role === 'assistant',
    );
    expect(assistantSaves[0]).toMatchObject({ status: 'pending' });
    expect(assistantSaves.at(-1)).toMatchObject({ status: 'completed', content: 'یکدوسه' });
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

    await service.streamChatTurn('user-1', 'conv-1', 'سلام', undefined, undefined, () => false, callbacks());

    expect(conversationsService.renameTitle).not.toHaveBeenCalled();
  });

  it('does not rename the conversation on a retry (replay)', async () => {
    setup({
      title: 'گفتگوی جدید',
      existingUserByClientMid: { id: 'cmid-existing', content: 'یک پیام' },
    });
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'ok';
    });

    await service.streamChatTurn(
      'user-1',
      'conv-1',
      'یک پیام',
      undefined,
      'cmid-existing',
      () => false,
      callbacks(),
    );

    // Replay ⇒ must NOT touch the title.
    expect(conversationsService.renameTitle).not.toHaveBeenCalled();
  });

  it('attributes each assistant message to the model that produced it when switching models mid-conversation', async () => {
    setup({
      history: [
        { role: 'user', content: 'اول' },
        { role: 'assistant', content: 'پاسخ با مدل یک' },
      ],
    });
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'ok';
    });

    modelsService.resolveChatModel.mockResolvedValueOnce({
      id: 'model-1',
      name: 'Mock One',
      provider: 'mock',
    });
    await service.streamChatTurn('user-1', 'conv-1', 'سلام', 'model-1', undefined, () => false, callbacks());

    modelsService.resolveChatModel.mockResolvedValueOnce({
      id: 'model-2',
      name: 'Mock Two',
      provider: 'mock',
    });
    await service.streamChatTurn('user-1', 'conv-1', 'سؤال دوم', 'model-2', undefined, () => false, callbacks());

    const assistantSaves = messagesRepository.saved.filter(
      (row: any) => row.role === 'assistant',
    );
    const finalSnapshots = assistantSaves
      .filter((row: any) => row.status === 'completed')
      .map((row: any) => ({ id: row.id, modelId: row.modelId, content: row.content }));
    expect(finalSnapshots).toHaveLength(2);
    expect(finalSnapshots[0]).toMatchObject({ modelId: 'model-1', content: 'ok' });
    expect(finalSnapshots[1]).toMatchObject({ modelId: 'model-2', content: 'ok' });
  });

  it('includes the persisted history plus the new user message in the provider request', async () => {
    setup({
      history: [
        { role: 'user', content: 'قبلی' },
        { role: 'assistant', content: 'پاسخ قبلی' },
      ],
    });
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'ok';
    });

    await service.streamChatTurn('user-1', 'conv-1', 'جدید', undefined, undefined, () => false, callbacks());

    const history = aiProviderService.streamChat.mock.calls[0][0];
    expect(history).toEqual([
      { role: 'user', content: 'قبلی' },
      { role: 'assistant', content: 'پاسخ قبلی' },
      { role: 'user', content: 'جدید' },
    ]);
  });

  // ---- Idempotency ----

  it('reuses an existing user row when clientMessageId matches', async () => {
    setup({
      existingUserByClientMid: { id: 'cmid-replay', content: 'پیام قبلی' },
      history: [{ role: 'user', content: 'پیام قبلی' }],
    });
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'پاسخ جدید';
    });
    const cb = callbacks();

    await service.streamChatTurn(
      'user-1',
      'conv-1',
      'پیام قبلی',
      undefined,
      'cmid-replay',
      () => false,
      cb,
    );

    // No user row was saved (the pre-existing one was reused — no duplicate).
    const userSaves = messagesRepository.saved.filter(
      (row: any) => row.role === 'user',
    );
    expect(userSaves).toHaveLength(0);
    // meta carries replay=true so the frontend can show the retry badge.
    expect(cb.onMeta.mock.calls[0][3]).toBe(true);
  });

  it('rejects a retry whose content does not match the original user row (pre-flight)', async () => {
    setup({
      existingUserByClientMid: { id: 'cmid-1', content: 'متن اصلی' },
    });

    // The content-collision check runs in assertChatTurnAllowed (before the
    // SSE headers are flushed), so it surfaces as a normal HTTP 400.
    await expect(
      service.assertChatTurnAllowed('user-1', 'conv-1', undefined, {
        clientMessageId: 'cmid-1',
        content: 'متن متفاوت',
      }),
    ).rejects.toThrow(BadRequestException);

    // A matching-content replay is allowed by the pre-flight (replay happens
    // inside streamChatTurn).
    await expect(
      service.assertChatTurnAllowed('user-1', 'conv-1', undefined, {
        clientMessageId: 'cmid-1',
        content: 'متن اصلی',
      }),
    ).resolves.toBeUndefined();

    // No idempotency key at all → no validation, no throw.
    await expect(
      service.assertChatTurnAllowed('user-1', 'conv-1', undefined, {
        content: 'متن اصلی',
      }),
    ).resolves.toBeUndefined();
  });

  it('creates a fresh user row when clientMessageId does not match anything', async () => {
    setup();
    aiProviderService.streamChat.mockImplementation(async function* () {
      yield 'ok';
    });

    await service.streamChatTurn(
      'user-1',
      'conv-1',
      'پیام جدید',
      undefined,
      'cmid-fresh',
      () => false,
      callbacks(),
    );

    const userSaves = messagesRepository.saved.filter(
      (row: any) => row.role === 'user',
    );
    expect(userSaves).toHaveLength(1);
    expect(userSaves[0]).toMatchObject({
      role: 'user',
      content: 'پیام جدید',
      clientMessageId: 'cmid-fresh',
    });
  });
});

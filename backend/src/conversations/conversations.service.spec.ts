import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { Conversation } from './conversation.entity';
import { createMockRepository } from '../test/mocks';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let repository: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repository = createMockRepository();
    service = new ConversationsService(repository as any);
  });

  it('creates a conversation for the given owner only', async () => {
    repository.save.mockImplementation(async (data: any) => ({ id: 'conv-1', ...data }));

    const conversation = await service.create('user-1', { title: '  سلام  ' });
    expect(conversation.userId).toBe('user-1');
    expect(conversation.title).toBe('سلام');
  });

  it('falls back to the default title for an empty one', async () => {
    repository.save.mockImplementation(async (data: any) => ({ id: 'conv-1', ...data }));
    const conversation = await service.create('user-1', {});
    expect(conversation.title).toBe('گفتگوی جدید');
  });

  it("returns a conversation to its owner", async () => {
    repository.findOne.mockResolvedValue({ id: 'conv-1', userId: 'user-1' } as Conversation);
    const conversation = await service.getOwned('user-1', 'conv-1');
    expect(conversation.id).toBe('conv-1');
  });

  it('hides other users’ conversations behind 404 (no existence leak)', async () => {
    // Model the DB honestly: the where clause filters on both id and userId.
    repository.findOne.mockImplementation(async (options: any) =>
      options.where.id === 'conv-1' && options.where.userId === 'user-B'
        ? { id: 'conv-1', userId: 'user-B' }
        : null,
    );
    await expect(service.getOwned('user-A', 'conv-1')).rejects.toThrow(NotFoundException);
  });

  it('rejects unknown conversation ids with 404', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.getOwned('user-1', 'missing')).rejects.toThrow(NotFoundException);
  });
});

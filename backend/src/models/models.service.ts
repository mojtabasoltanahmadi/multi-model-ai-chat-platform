import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AiModel } from './ai-model.entity';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

/** Shape returned to clients - never includes the provider API key. */
export type SafeModel = Omit<AiModel, 'apiKey'> & { hasApiKey: boolean };

@Injectable()
export class ModelsService {
  constructor(
    @InjectRepository(AiModel)
    private readonly modelsRepository: Repository<AiModel>,
  ) {}

  /** All models for the admin panel (API key stripped). */
  async listAll(): Promise<SafeModel[]> {
    const models = await this.modelsRepository.find({ order: { createdAt: 'ASC' } });
    return models.map((model) => this.toSafeModel(model));
  }

  /** Active models only - the list regular users can pick from when chatting. */
  async listActive(): Promise<SafeModel[]> {
    const models = await this.modelsRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    return models.map((model) => this.toSafeModel(model));
  }

  async create(dto: CreateModelDto): Promise<SafeModel> {
    const willBeActive = dto.isActive ?? true;

    const model = this.modelsRepository.create({
      name: dto.name.trim(),
      provider: dto.provider,
      externalModelId: dto.externalModelId.trim(),
      baseUrl: dto.baseUrl?.trim() || null,
      apiKey: dto.apiKey?.trim() || null,
      isActive: willBeActive,
      isDefault: false,
    });

    // Convenience only: the first active model automatically becomes the
    // default so a fresh installation can chat right away.
    const defaultExists = await this.modelsRepository.exists({ where: { isDefault: true } });
    if (willBeActive && !defaultExists) {
      model.isDefault = true;
    }

    return this.toSafeModel(await this.modelsRepository.save(model));
  }

  async update(id: string, dto: UpdateModelDto): Promise<SafeModel> {
    const model = await this.modelsRepository.findOne({ where: { id } });
    if (!model) throw new NotFoundException('مدل پیدا نشد.');

    if (dto.isActive === false && model.isDefault) {
      throw new BadRequestException(
        'مدل پیش‌فرض را نمی‌توان غیرفعال کرد. ابتدا یک مدل دیگر را پیش‌فرض کنید.',
      );
    }

    if (dto.name !== undefined) model.name = dto.name.trim();
    if (dto.provider !== undefined) model.provider = dto.provider;
    if (dto.externalModelId !== undefined) model.externalModelId = dto.externalModelId.trim();
    if (dto.baseUrl !== undefined) model.baseUrl = dto.baseUrl?.trim() || null;
    if (dto.apiKey !== undefined) model.apiKey = dto.apiKey.trim() || null;
    if (dto.isActive !== undefined) model.isActive = dto.isActive;

    return this.toSafeModel(await this.modelsRepository.save(model));
  }

  /**
   * Invariant: at most one default model, and it must be active.
   * The swap runs in a transaction so both rows change atomically.
   */
  async setDefault(id: string): Promise<SafeModel> {
    const model = await this.modelsRepository.findOne({ where: { id } });
    if (!model) throw new NotFoundException('مدل پیدا نشد.');
    if (!model.isActive) {
      throw new BadRequestException('فقط مدل فعال می‌تواند پیش‌فرض شود.');
    }

    await this.modelsRepository.manager.transaction(async (entityManager: EntityManager) => {
      await entityManager.update(AiModel, { isDefault: true }, { isDefault: false });
      await entityManager.update(AiModel, { id: model.id }, { isDefault: true });
    });

    model.isDefault = true;
    return this.toSafeModel(model);
  }

  async remove(id: string): Promise<void> {
    const model = await this.modelsRepository.findOne({ where: { id } });
    if (!model) throw new NotFoundException('مدل پیدا نشد.');
    if (model.isDefault) {
      throw new BadRequestException(
        'مدل پیش‌فرض قابل حذف نیست. ابتدا یک مدل دیگر را پیش‌فرض کنید.',
      );
    }
    await this.modelsRepository.remove(model);
  }

  /**
   * Resolves the model for a new chat turn: the requested one (must be active)
   * or the system default. Inactive/unknown models are never used.
   */
  async resolveChatModel(modelId?: string): Promise<AiModel> {
    let model: AiModel | null = null;

    if (modelId) {
      model = await this.modelsRepository.findOne({ where: { id: modelId } });
      if (!model) throw new NotFoundException('مدل درخواستی پیدا نشد.');
      if (!model.isActive) {
        throw new BadRequestException('این مدل غیرفعال است و قابل استفاده نیست.');
      }
      return model;
    }

    model = await this.modelsRepository.findOne({ where: { isDefault: true } });
    if (!model) {
      throw new BadRequestException(
        'هنوز مدل پیش‌فرضی تنظیم نشده است. با مدیر سیستم تماس بگیرید.',
      );
    }
    if (!model.isActive) {
      throw new BadRequestException('مدل پیش‌فرض غیرفعال است. با مدیر سیستم تماس بگیرید.');
    }
    return model;
  }

  async existingByIds(ids: string[]): Promise<AiModel[]> {
    if (ids.length === 0) return [];
    return this.modelsRepository.find({ where: { id: In(ids) } });
  }

  private toSafeModel(model: AiModel): SafeModel {
    const { apiKey, ...rest } = model;
    return { ...rest, hasApiKey: Boolean(apiKey) };
  }
}

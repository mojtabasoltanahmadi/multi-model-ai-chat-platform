import { Controller, Get } from '@nestjs/common';
import { ModelsService } from './models.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** Active models for the chat UI. Requires login; no admin role needed. */
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  listActive(@CurrentUser() _user: { id: string }) {
    return this.modelsService.listActive();
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ModelsService } from './models.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { Roles } from '../common/decorators/roles.decorator';

/** Admin-only AI model management. */
@Roles('admin')
@Controller('admin/models')
export class AdminModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  list() {
    return this.modelsService.listAll();
  }

  @Post()
  create(@Body() dto: CreateModelDto) {
    return this.modelsService.create(dto);
  }

  @Patch(':modelId')
  update(
    @Param('modelId', ParseUUIDPipe) modelId: string,
    @Body() dto: UpdateModelDto,
  ) {
    return this.modelsService.update(modelId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':modelId/default')
  setDefault(@Param('modelId', ParseUUIDPipe) modelId: string) {
    return this.modelsService.setDefault(modelId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':modelId')
  async remove(@Param('modelId', ParseUUIDPipe) modelId: string) {
    await this.modelsService.remove(modelId);
  }
}

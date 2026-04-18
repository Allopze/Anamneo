import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConditionsService } from './conditions.service';
import { ConditionsCsvService } from './conditions-csv.service';
import { CreateConditionDto } from './dto/create-condition.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';
import { SuggestConditionDto } from './dto/suggest-condition.dto';
import { SaveSuggestionDto } from './dto/save-suggestion.dto';
import { CreateLocalConditionDto } from './dto/create-local-condition.dto';
import { UpdateLocalConditionDto } from './dto/update-local-condition.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('conditions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConditionsController {
  constructor(
    private readonly conditionsService: ConditionsService,
    private readonly conditionsCsvService: ConditionsCsvService,
  ) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() createDto: CreateConditionDto) {
    return this.conditionsService.create(createDto);
  }

  @Post('import/csv')
  @UseGuards(AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 1024 * 1024,
      },
    }),
  )
  importCsv(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.conditionsCsvService.importGlobalCsv(this.getCsvImportBuffer(user, file), user.id);
  }

  @Post('import/csv/preview')
  @UseGuards(AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 1024 * 1024,
      },
    }),
  )
  previewCsv(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.conditionsCsvService.previewGlobalCsv(this.getCsvImportBuffer(user, file));
  }

  @Get()
  @Roles('ADMIN', 'MEDICO', 'ASISTENTE')
  findAll(@Query('search') search: string | undefined, @CurrentUser() user: CurrentUserData) {
    return this.conditionsService.findAll(search, user);
  }

  @Get(':id')
  @Roles('ADMIN', 'MEDICO', 'ASISTENTE')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.conditionsService.findById(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateConditionDto,
  ) {
    return this.conditionsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.conditionsService.remove(id);
  }

  @Post('suggest')
  @Roles('ADMIN', 'MEDICO', 'ASISTENTE')
  suggest(@Body() suggestDto: SuggestConditionDto, @CurrentUser() user: CurrentUserData) {
    return this.conditionsService.suggest(user, suggestDto);
  }

  @Post('local')
  @Roles('MEDICO', 'ASISTENTE')
  createLocal(
    @CurrentUser() user: CurrentUserData,
    @Body() createDto: CreateLocalConditionDto,
  ) {
    return this.conditionsService.createLocal(user, createDto);
  }

  @Put('local/:id')
  @Roles('MEDICO', 'ASISTENTE')
  updateLocal(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateLocalConditionDto,
  ) {
    return this.conditionsService.updateLocal(user, id, updateDto);
  }

  @Delete('local/:id')
  @Roles('MEDICO', 'ASISTENTE')
  removeLocal(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.conditionsService.removeLocal(user, id);
  }

  @Delete('local/base/:baseId')
  @Roles('MEDICO', 'ASISTENTE')
  hideBaseCondition(
    @CurrentUser() user: CurrentUserData,
    @Param('baseId', ParseUUIDPipe) baseId: string,
  ) {
    return this.conditionsService.hideBaseCondition(user, baseId);
  }

  @Post('encounters/:encounterId/suggestion')
  @Roles('MEDICO')
  saveSuggestion(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Body() dto: SaveSuggestionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.conditionsService.saveSuggestionChoice(encounterId, dto, user);
  }

  private getCsvImportBuffer(user: CurrentUserData, file?: Express.Multer.File) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo un administrador con rol ADMIN puede importar CSV global');
    }

    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo CSV');
    }

    return file.buffer;
  }
}

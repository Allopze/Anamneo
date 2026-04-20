import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { MedicationsCsvService } from './medications-csv.service';
import { MedicationsService } from './medications.service';

@Controller('medications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicationsController {
  constructor(
    private readonly medicationsService: MedicationsService,
    private readonly medicationsCsvService: MedicationsCsvService,
  ) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() createDto: CreateMedicationDto) {
    return this.medicationsService.create(createDto);
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
    return this.medicationsCsvService.importGlobalCsv(this.getCsvImportBuffer(user, file), user.id);
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
    return this.medicationsCsvService.previewGlobalCsv(this.getCsvImportBuffer(user, file));
  }

  @Get()
  @Roles('ADMIN', 'MEDICO', 'ASISTENTE')
  findAll(@Query('search') search: string | undefined, @CurrentUser() user: CurrentUserData) {
    return this.medicationsService.findAll(search, user);
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationsService.findById(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMedicationDto,
  ) {
    return this.medicationsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationsService.remove(id);
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
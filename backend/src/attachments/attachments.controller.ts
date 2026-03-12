import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('encounter/:encounterId')
  @Roles('MEDICO', 'ASISTENTE')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserData,
  ) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }
    return this.attachmentsService.create(encounterId, file, user);
  }

  @Get('encounter/:encounterId')
  findByEncounter(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.attachmentsService.findByEncounter(encounterId, user);
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @CurrentUser() user: CurrentUserData,
  ) {
    const file = await this.attachmentsService.getFile(id, user);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.sendFile(file.path, { root: '.' });
  }

  @Delete(':id')
  @Roles('MEDICO')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.attachmentsService.remove(id, user.id);
  }
}

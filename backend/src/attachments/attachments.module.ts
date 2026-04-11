import { BadRequestException, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { v4 as uuid } from 'uuid';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { resolveUploadsRoot } from '../common/utils/uploads-root';

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif']);

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uploadsRoot = resolveUploadsRoot(configService.get<string>('UPLOAD_DEST'));
        mkdirSync(uploadsRoot, { recursive: true });

        return {
          storage: diskStorage({
            destination: uploadsRoot,
            filename: (req, file, cb) => {
              const uniqueName = `${uuid()}${extname(file.originalname)}`;
              cb(null, uniqueName);
            },
          }),
          limits: {
            fileSize: configService.get<number>('UPLOAD_MAX_SIZE', 10 * 1024 * 1024), // 10MB default
          },
          fileFilter: (req, file, cb) => {
            const extension = extname(file.originalname || '').toLowerCase();
            if (ALLOWED_MIMES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(extension)) {
              cb(null, true);
            } else {
              cb(new BadRequestException('Tipo de archivo no permitido'), false);
            }
          },
        };
      },
    }),
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}

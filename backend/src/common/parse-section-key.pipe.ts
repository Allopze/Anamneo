import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { VALID_SECTION_KEYS } from '../encounters/dto/update-section.dto';
import { SectionKey } from './types';

@Injectable()
export class ParseSectionKeyPipe implements PipeTransform<string, SectionKey> {
  transform(value: string): SectionKey {
    if (!VALID_SECTION_KEYS.includes(value as any)) {
      throw new BadRequestException(
        `Sección inválida: "${value}". Valores permitidos: ${VALID_SECTION_KEYS.join(', ')}`,
      );
    }
    return value as SectionKey;
  }
}

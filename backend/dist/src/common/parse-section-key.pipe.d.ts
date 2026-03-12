import { PipeTransform } from '@nestjs/common';
import { SectionKey } from './types';
export declare class ParseSectionKeyPipe implements PipeTransform<string, SectionKey> {
    transform(value: string): SectionKey;
}

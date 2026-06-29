import { Module } from '@nestjs/common';
import { Cie10Controller } from './cie10.controller';

@Module({
  controllers: [Cie10Controller],
})
export class Cie10Module {}

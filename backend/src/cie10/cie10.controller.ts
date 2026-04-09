import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { searchCie10 } from './cie10-catalog';

@Controller('cie10')
@UseGuards(JwtAuthGuard)
export class Cie10Controller {
  @Get('search')
  search(@Query('q') query: string, @Query('limit') limit?: string) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    return searchCie10(query.trim(), limit ? parseInt(limit, 10) : 20);
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('acceptances/me')
  @UseGuards(JwtAuthGuard)
  listMyAcceptances(@CurrentUser() user: CurrentUserData) {
    return this.legalService.listUserAcceptances(user.id);
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { UpdateOnboardingProgressDto } from './dto/update-onboarding-progress.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('me')
  getMine(@CurrentUser() user: CurrentUserData) {
    return this.onboardingService.getForUser(user);
  }

  @Patch('me')
  updateMine(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateOnboardingProgressDto,
  ) {
    return this.onboardingService.updateForUser(user, dto);
  }

  @Post('me/reset')
  @HttpCode(HttpStatus.OK)
  resetMine(@CurrentUser() user: CurrentUserData) {
    return this.onboardingService.resetForUser(user);
  }
}

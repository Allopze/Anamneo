import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';
import { ClinicalAnalyticsCasesQueryDto } from './dto/clinical-analytics-cases-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('clinical/summary')
  @Roles('MEDICO')
  getClinicalSummary(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ClinicalAnalyticsQueryDto,
  ) {
    return this.analyticsService.getClinicalSummary(user, query);
  }

  @Get('clinical/cases')
  @Roles('MEDICO')
  getClinicalCases(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ClinicalAnalyticsCasesQueryDto,
  ) {
    return this.analyticsService.getClinicalCases(user, query);
  }
}
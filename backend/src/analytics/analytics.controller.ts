import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('clinical/summary/export/csv')
  @Roles('MEDICO')
  async exportClinicalSummaryCsv(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ClinicalAnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.analyticsService.exportClinicalSummaryCsv(user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=resumen_analitica_clinica_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  }

  @Get('clinical/summary/export/md')
  @Roles('MEDICO')
  async exportClinicalSummaryMarkdown(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ClinicalAnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const markdown = await this.analyticsService.exportClinicalSummaryMarkdown(user, query);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_analitica_clinica_${new Date().toISOString().slice(0, 10)}.md`);
    res.send(markdown);
  }

  @Get('clinical/cases')
  @Roles('MEDICO')
  getClinicalCases(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ClinicalAnalyticsCasesQueryDto,
  ) {
    return this.analyticsService.getClinicalCases(user, query);
  }

  @Get('clinical/cases/export/csv')
  @Roles('MEDICO')
  async exportClinicalCasesCsv(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ClinicalAnalyticsCasesQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.analyticsService.exportClinicalCasesCsv(user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=casos_analiticos_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  }
}
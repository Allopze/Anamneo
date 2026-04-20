import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { getClinicalAnalyticsSummaryReadModel } from './clinical-analytics.read-model';
import { ClinicalAnalyticsQueryDto } from './dto/clinical-analytics-query.dto';
import { getClinicalAnalyticsCasesReadModel } from './clinical-analytics.cases.read-model';
import { ClinicalAnalyticsCasesQueryDto } from './dto/clinical-analytics-cases-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertClinicalAnalyticsAccess(user: CurrentUserData) {
    if (user.role !== 'MEDICO' || user.isAdmin) {
      throw new ForbiddenException('La analítica clínica solo está disponible para médicos no administrativos');
    }
  }

  getClinicalSummary(user: CurrentUserData, query: ClinicalAnalyticsQueryDto) {
    this.assertClinicalAnalyticsAccess(user);

    return getClinicalAnalyticsSummaryReadModel({
      prisma: this.prisma,
      user,
      query,
    });
  }

  getClinicalCases(user: CurrentUserData, query: ClinicalAnalyticsCasesQueryDto) {
    this.assertClinicalAnalyticsAccess(user);

    return getClinicalAnalyticsCasesReadModel({
      prisma: this.prisma,
      user,
      query,
    });
  }
}
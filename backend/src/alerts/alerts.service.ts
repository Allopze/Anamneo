import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/alert.dto';
import { RequestUser } from '../common/utils/medico-id';
import { assertPatientAccess, buildAccessiblePatientsWhere } from '../common/utils/patient-access';

const ALERT_SEVERITY_WEIGHT: Record<string, number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  BAJA: 1,
};

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertEncounterMatchesPatient(encounterId: string, patientId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { patientId: true },
    });

    if (!encounter) {
      throw new BadRequestException('La atención indicada no existe');
    }

    if (encounter.patientId !== patientId) {
      throw new BadRequestException('La atención indicada no corresponde al paciente');
    }
  }

  private sortAlertsByPriority<T extends { severity: string; createdAt: Date }>(alerts: T[]) {
    return [...alerts].sort((left, right) => {
      const severityDelta = (ALERT_SEVERITY_WEIGHT[right.severity] || 0) - (ALERT_SEVERITY_WEIGHT[left.severity] || 0);
      if (severityDelta !== 0) {
        return severityDelta;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });
  }

  private async attachUserNames<
    T extends {
      createdById: string;
      acknowledgedById?: string | null;
    },
  >(alerts: T[]) {
    const userIds = Array.from(
      new Set(
        alerts
          .flatMap((alert) => [alert.createdById, alert.acknowledgedById])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (userIds.length === 0) {
      return alerts.map((alert) => ({
        ...alert,
        createdBy: null,
        acknowledgedBy: null,
      }));
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nombre: true },
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    return alerts.map((alert) => ({
      ...alert,
      createdBy: userMap.get(alert.createdById) || null,
      acknowledgedBy: alert.acknowledgedById ? userMap.get(alert.acknowledgedById) || null : null,
    }));
  }

  async create(dto: CreateAlertDto, user: RequestUser) {
    await assertPatientAccess(this.prisma, user, dto.patientId);

    if (dto.encounterId) {
      await this.assertEncounterMatchesPatient(dto.encounterId, dto.patientId);
    }

    return this.prisma.clinicalAlert.create({
      data: {
        patientId: dto.patientId,
        encounterId: dto.encounterId ?? null,
        type: dto.type,
        severity: dto.severity,
        title: dto.title,
        message: dto.message,
        createdById: user.id,
      },
    });
  }

  async findByPatient(patientId: string, user: RequestUser, includeAcknowledged = false) {
    await assertPatientAccess(this.prisma, user, patientId);

    const alerts = await this.prisma.clinicalAlert.findMany({
      where: {
        patientId,
        ...(includeAcknowledged ? {} : { acknowledgedAt: null }),
      },
    });

    const sortedAlerts = this.sortAlertsByPriority(alerts);
    return this.attachUserNames(sortedAlerts);
  }

  async acknowledge(id: string, user: RequestUser) {
    const alert = await this.prisma.clinicalAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alerta no encontrada');

    await assertPatientAccess(this.prisma, user, alert.patientId);

    return this.prisma.clinicalAlert.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: user.id,
      },
    });
  }

  /** Auto-generate alerts from vital signs in encounter sections */
  async checkVitalSigns(patientId: string, encounterId: string, vitals: Record<string, string>, userId: string) {
    const alerts: string[] = [];

    const systolic = vitals.presionArterial ? parseInt(vitals.presionArterial.split('/')[0]) : null;
    const diastolic = vitals.presionArterial ? parseInt(vitals.presionArterial.split('/')[1]) : null;
    const temp = vitals.temperatura ? parseFloat(vitals.temperatura) : null;
    const satO2 = vitals.saturacionOxigeno ? parseFloat(vitals.saturacionOxigeno) : null;
    const fc = vitals.frecuenciaCardiaca ? parseInt(vitals.frecuenciaCardiaca) : null;

    if (systolic && systolic >= 180) alerts.push('Presión arterial sistólica crítica: ' + vitals.presionArterial);
    if (diastolic && diastolic >= 120) alerts.push('Presión arterial diastólica crítica: ' + vitals.presionArterial);
    if (temp && temp >= 39.5) alerts.push('Temperatura crítica: ' + temp + '°C');
    if (satO2 && satO2 < 90) alerts.push('Saturación de oxígeno crítica: ' + satO2 + '%');
    if (fc && (fc < 40 || fc > 150)) alerts.push('Frecuencia cardíaca fuera de rango: ' + fc + ' lpm');

    let createdAlerts = 0;

    for (const message of alerts) {
      const existingAlert = await this.prisma.clinicalAlert.findFirst({
        where: {
          patientId,
          encounterId,
          type: 'SIGNOS_VITALES',
          severity: 'CRITICA',
          title: 'Alerta de signos vitales',
          message,
          autoGenerated: true,
          acknowledgedAt: null,
        },
        select: { id: true },
      });

      if (existingAlert) {
        continue;
      }

      await this.prisma.clinicalAlert.create({
        data: {
          patientId,
          encounterId,
          type: 'SIGNOS_VITALES',
          severity: 'CRITICA',
          title: 'Alerta de signos vitales',
          message,
          autoGenerated: true,
          createdById: userId,
        },
      });

      createdAlerts += 1;
    }

    return createdAlerts;
  }

  async countUnacknowledged(user: RequestUser): Promise<number> {
    const patientWhere = buildAccessiblePatientsWhere(user);

    return this.prisma.clinicalAlert.count({
      where: {
        acknowledgedAt: null,
        patient: patientWhere,
      },
    });
  }

  async findRecentUnacknowledged(user: RequestUser, take = 10) {
    const patientWhere = buildAccessiblePatientsWhere(user);

    const alerts = await this.prisma.clinicalAlert.findMany({
      where: {
        acknowledgedAt: null,
        patient: patientWhere,
      },
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        message: true,
        createdAt: true,
        patient: {
          select: { id: true, nombre: true },
        },
      },
    });

    return this.sortAlertsByPriority(alerts).slice(0, take);
  }
}

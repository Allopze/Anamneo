import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getOnboardingStepsForRole,
  isOnboardingRole,
  ONBOARDING_VERSION,
  type OnboardingRole,
} from '../../../shared/onboarding-contract';

interface CurrentOnboardingUser {
  id: string;
  role: string;
}

interface UpdateOnboardingProgressInput {
  completedStepIds?: string[];
  dismissed?: boolean;
  completed?: boolean;
}

function parseCompletedStepIds(rawValue: string | null | undefined) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(user: CurrentOnboardingUser) {
    if (!isOnboardingRole(user.role)) {
      return this.buildResponse(user.role, null);
    }

    const progress = await this.prisma.userOnboardingProgress.findUnique({
      where: {
        userId_version: {
          userId: user.id,
          version: ONBOARDING_VERSION,
        },
      },
    });

    return this.buildResponse(user.role, progress);
  }

  async updateForUser(user: CurrentOnboardingUser, input: UpdateOnboardingProgressInput) {
    if (!isOnboardingRole(user.role)) {
      return this.buildResponse(user.role, null);
    }

    const steps = getOnboardingStepsForRole(user.role);
    const validStepIds = new Set(steps.map((step) => step.id));
    const now = new Date();
    const data: {
      completedStepIds?: string;
      dismissedAt?: Date | null;
      completedAt?: Date | null;
    } = {};

    if (input.completedStepIds) {
      const unknownStepIds = input.completedStepIds.filter((stepId) => !validStepIds.has(stepId as any));
      if (unknownStepIds.length > 0) {
        throw new BadRequestException('El progreso contiene pasos de onboarding inválidos');
      }

      const uniqueStepIds = [...new Set(input.completedStepIds)];
      data.completedStepIds = JSON.stringify(uniqueStepIds);
      data.completedAt = uniqueStepIds.length === steps.length ? now : null;
    }

    if (input.dismissed !== undefined) {
      data.dismissedAt = input.dismissed ? now : null;
    }

    if (input.completed !== undefined) {
      data.completedAt = input.completed ? now : null;
      if (input.completed) {
        data.completedStepIds = JSON.stringify(steps.map((step) => step.id));
      }
    }

    const progress = await this.prisma.userOnboardingProgress.upsert({
      where: {
        userId_version: {
          userId: user.id,
          version: ONBOARDING_VERSION,
        },
      },
      update: data,
      create: {
        userId: user.id,
        version: ONBOARDING_VERSION,
        completedStepIds: data.completedStepIds ?? '[]',
        dismissedAt: data.dismissedAt,
        completedAt: data.completedAt,
      },
    });

    return this.buildResponse(user.role, progress);
  }

  async resetForUser(user: CurrentOnboardingUser) {
    if (!isOnboardingRole(user.role)) {
      return this.buildResponse(user.role, null);
    }

    const progress = await this.prisma.userOnboardingProgress.upsert({
      where: {
        userId_version: {
          userId: user.id,
          version: ONBOARDING_VERSION,
        },
      },
      update: {
        completedStepIds: '[]',
        dismissedAt: null,
        completedAt: null,
      },
      create: {
        userId: user.id,
        version: ONBOARDING_VERSION,
        completedStepIds: '[]',
      },
    });

    return this.buildResponse(user.role, progress);
  }

  private buildResponse(
    role: string,
    progress: {
      completedStepIds: string;
      dismissedAt: Date | null;
      completedAt: Date | null;
    } | null,
  ) {
    const eligible = isOnboardingRole(role);
    const steps = eligible ? getOnboardingStepsForRole(role) : [];
    const validStepIds = new Set(steps.map((step) => step.id));
    const completedStepIds = parseCompletedStepIds(progress?.completedStepIds)
      .filter((stepId) => validStepIds.has(stepId as any));
    const isComplete = eligible && (Boolean(progress?.completedAt) || completedStepIds.length === steps.length);

    return {
      version: ONBOARDING_VERSION,
      eligible,
      role: eligible ? (role as OnboardingRole) : null,
      steps,
      completedStepIds,
      dismissedAt: progress?.dismissedAt ?? null,
      completedAt: progress?.completedAt ?? null,
      isComplete,
    };
  }
}

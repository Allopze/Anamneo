import { BadRequestException } from '@nestjs/common';
import { ONBOARDING_VERSION } from '../../../shared/onboarding-contract';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  let prisma: {
    userOnboardingProgress: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let service: OnboardingService;

  beforeEach(() => {
    prisma = {
      userOnboardingProgress: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    service = new OnboardingService(prisma as any);
  });

  it('returns ineligible state for admin users', async () => {
    const result = await service.getForUser({ id: 'admin-1', role: 'ADMIN' });

    expect(result).toEqual({
      version: ONBOARDING_VERSION,
      eligible: false,
      role: null,
      steps: [],
      completedStepIds: [],
      dismissedAt: null,
      completedAt: null,
      isComplete: false,
    });
    expect(prisma.userOnboardingProgress.findUnique).not.toHaveBeenCalled();
  });

  it('returns medico-specific steps', async () => {
    prisma.userOnboardingProgress.findUnique.mockResolvedValue(null);

    const result = await service.getForUser({ id: 'medico-1', role: 'MEDICO' });

    expect(result.eligible).toBe(true);
    expect(result.role).toBe('MEDICO');
    expect(result.steps.map((step) => step.id)).toEqual([
      'review_dashboard',
      'create_patient',
      'create_encounter',
      'complete_sections',
      'close_or_sign',
    ]);
  });

  it('returns assistant-specific steps', async () => {
    prisma.userOnboardingProgress.findUnique.mockResolvedValue(null);

    const result = await service.getForUser({ id: 'assistant-1', role: 'ASISTENTE' });

    expect(result.eligible).toBe(true);
    expect(result.role).toBe('ASISTENTE');
    expect(result.steps.map((step) => step.id)).toEqual([
      'review_dashboard',
      'create_patient',
      'support_encounter',
      'review_followups',
      'attachments_and_alerts',
    ]);
  });

  it('rejects step IDs outside the user role contract', async () => {
    await expect(
      service.updateForUser(
        { id: 'assistant-1', role: 'ASISTENTE' },
        { completedStepIds: ['create_encounter'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.userOnboardingProgress.upsert).not.toHaveBeenCalled();
  });

  it('resets stored progress for the active version', async () => {
    prisma.userOnboardingProgress.upsert.mockResolvedValue({
      completedStepIds: '[]',
      dismissedAt: null,
      completedAt: null,
    });

    const result = await service.resetForUser({ id: 'medico-1', role: 'MEDICO' });

    expect(prisma.userOnboardingProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_version: {
            userId: 'medico-1',
            version: ONBOARDING_VERSION,
          },
        },
        update: {
          completedStepIds: '[]',
          dismissedAt: null,
          completedAt: null,
        },
      }),
    );
    expect(result.completedStepIds).toEqual([]);
    expect(result.isComplete).toBe(false);
  });
});

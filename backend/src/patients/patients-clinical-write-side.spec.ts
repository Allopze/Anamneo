import { RequestUser } from '../common/utils/medico-id';
import {
  createPatientProblemCommand,
  createPatientTaskCommand,
  updatePatientProblemCommand,
  updatePatientTaskCommand,
} from './patients-clinical-write-side';
import {
  createPatientProblemMutation,
  createPatientTaskMutation,
  updatePatientProblemMutation,
  updatePatientTaskMutation,
} from './patients-clinical-mutations';

jest.mock('./patients-clinical-mutations', () => ({
  createPatientProblemMutation: jest.fn(),
  updatePatientProblemMutation: jest.fn(),
  createPatientTaskMutation: jest.fn(),
  updatePatientTaskMutation: jest.fn(),
}));

describe('patients-clinical-write-side', () => {
  const deps = {
    prisma: {} as never,
    auditService: {} as never,
    assertPatientAccess: jest.fn().mockResolvedValue(undefined),
  };

  const medicoUser: RequestUser = {
    id: 'med-1',
    role: 'MEDICO',
    isAdmin: false,
  };

  const assistantUser: RequestUser = {
    id: 'assistant-1',
    role: 'ASISTENTE',
    isAdmin: false,
    medicoId: 'med-2',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates create problem using effectiveMedicoId for medicos', async () => {
    (createPatientProblemMutation as jest.Mock).mockResolvedValue({ id: 'problem-1' });

    const result = await createPatientProblemCommand({
      ...deps,
      user: medicoUser,
      patientId: 'patient-1',
      dto: {
        label: 'Hipertension',
      },
    });

    expect(createPatientProblemMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        user: medicoUser,
        patientId: 'patient-1',
        effectiveMedicoId: 'med-1',
        assertPatientAccess: deps.assertPatientAccess,
      }),
    );
    expect(result).toEqual({ id: 'problem-1' });
  });

  it('delegates create task using assigned medicoId for assistants', async () => {
    (createPatientTaskMutation as jest.Mock).mockResolvedValue({ id: 'task-1' });

    const result = await createPatientTaskCommand({
      ...deps,
      user: assistantUser,
      patientId: 'patient-1',
      dto: {
        title: 'Control en 7 dias',
      },
    });

    expect(createPatientTaskMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        user: assistantUser,
        patientId: 'patient-1',
        effectiveMedicoId: 'med-2',
        assertPatientAccess: deps.assertPatientAccess,
      }),
    );
    expect(result).toEqual({ id: 'task-1' });
  });

  it('delegates update problem and returns mutation response', async () => {
    (updatePatientProblemMutation as jest.Mock).mockResolvedValue({ id: 'problem-1', status: 'RESUELTO' });

    const result = await updatePatientProblemCommand({
      ...deps,
      user: medicoUser,
      problemId: 'problem-1',
      dto: {
        status: 'RESUELTO',
      },
    });

    expect(updatePatientProblemMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        user: medicoUser,
        problemId: 'problem-1',
        effectiveMedicoId: 'med-1',
      }),
    );
    expect(result).toEqual({ id: 'problem-1', status: 'RESUELTO' });
  });

  it('delegates update task and returns mutation response', async () => {
    (updatePatientTaskMutation as jest.Mock).mockResolvedValue({ id: 'task-1', status: 'COMPLETADA' });

    const result = await updatePatientTaskCommand({
      ...deps,
      user: medicoUser,
      taskId: 'task-1',
      dto: {
        status: 'COMPLETADA',
      },
    });

    expect(updatePatientTaskMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        user: medicoUser,
        taskId: 'task-1',
        effectiveMedicoId: 'med-1',
      }),
    );
    expect(result).toEqual({ id: 'task-1', status: 'COMPLETADA' });
  });
});

export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '$2b$10$hashedpassword',
  nombre: 'Test User',
  role: 'MEDICO',
  isAdmin: false,
  active: true,
  refreshTokenVersion: 1,
};

export const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  tokenVersion: 1,
  userAgent: null,
  ipAddress: null,
  revokedAt: null,
};

export function createMockServices() {
  const usersService = {
    findByEmail: jest.fn(),
    countUsers: jest.fn(),
    countActiveAdmins: jest.fn(),
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue({
      id: 'medico-1',
      role: 'MEDICO',
      active: true,
    }),
  };

  const sessionService = {
    findAuthById: jest.fn().mockResolvedValue(mockUser),
    rotateRefreshTokenVersion: jest.fn().mockResolvedValue(2),
    createSession: jest.fn().mockResolvedValue(mockSession),
    findActiveSessionById: jest.fn().mockResolvedValue(mockSession),
    rotateSessionTokenVersion: jest.fn().mockResolvedValue({
      ...mockSession,
      tokenVersion: 2,
    }),
    revokeSessionById: jest.fn(),
    revokeAllSessionsForUser: jest.fn(),
  };

  const invitationService = {
    findInvitationByToken: jest.fn().mockResolvedValue(null),
    acceptInvitation: jest.fn(),
  };

  const prismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ totpEnabled: false }),
    },
    loginAttempt: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const jwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
  };

  const configService = {
    get: jest.fn().mockReturnValue('test-secret'),
    getOrThrow: jest.fn().mockReturnValue('test-refresh-secret'),
  };

  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  return {
    usersService,
    sessionService,
    invitationService,
    prismaService,
    jwtService,
    configService,
    auditService,
  };
}

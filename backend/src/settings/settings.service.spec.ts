import { ConfigService } from '@nestjs/config';
import { SettingsService } from './settings.service';
import { decryptSettingValue, encryptSettingValue } from './settings-encryption';

describe('SettingsService', () => {
  const activeKey = '0123456789abcdef0123456789abcdef';
  const oldKey = 'fedcba9876543210fedcba9876543210';

  let service: SettingsService;
  let prisma: {
    setting: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      setting: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'SETTINGS_ENCRYPTION_KEY') return activeKey;
        if (key === 'SETTINGS_ENCRYPTION_KEYS') return oldKey;
        return undefined;
      }),
    };

    service = new SettingsService(prisma as any, configService as unknown as ConfigService);
  });

  it('migrates legacy plaintext smtp passwords to encrypted storage on read', async () => {
    prisma.setting.findMany.mockResolvedValue([
      { id: 'setting-1', key: 'smtp.password', value: 'SMTP.LegacySecret123' },
      { id: 'setting-2', key: 'smtp.host', value: 'smtp.demo.cl' },
    ]);

    const settings = await service.getAllAdminView();

    expect(settings['smtp.password']).toBeUndefined();
    expect(settings['smtp.passwordConfigured']).toBe('true');
    expect(settings['smtp.host']).toBe('smtp.demo.cl');
    expect(prisma.setting.update).toHaveBeenCalledTimes(1);

    const encryptedValue = prisma.setting.update.mock.calls[0][0].data.value;
    expect(encryptedValue).not.toBe('SMTP.LegacySecret123');
    expect(encryptedValue.startsWith('enc:v1:')).toBe(true);
    expect(decryptSettingValue(encryptedValue, activeKey)).toBe('SMTP.LegacySecret123');
  });

  it('rewraps smtp passwords encrypted with an old key to the active key on read', async () => {
    prisma.setting.findMany.mockResolvedValue([
      {
        id: 'setting-1',
        key: 'smtp.password',
        value: encryptSettingValue('SMTP.RotatedSecret123', oldKey),
      },
    ]);

    const settings = await service.getAllAdminView();

    expect(settings['smtp.passwordConfigured']).toBe('true');
    expect(prisma.setting.update).toHaveBeenCalledTimes(1);

    const rewrappedValue = prisma.setting.update.mock.calls[0][0].data.value;
    expect(rewrappedValue.startsWith('enc:v1:')).toBe(true);
    expect(decryptSettingValue(rewrappedValue, activeKey)).toBe('SMTP.RotatedSecret123');
  });

  it('writes smtp passwords encrypted and leaves non-secret settings in plaintext', async () => {
    prisma.setting.upsert.mockImplementation(({ create }: any) => Promise.resolve(create));
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));

    const result = await service.setMany({
      'smtp.password': 'SMTP.NewSecret123',
      'smtp.host': 'smtp.demo.cl',
    });

    expect(Array.isArray(result)).toBe(true);
    expect(prisma.setting.upsert).toHaveBeenCalledTimes(2);

    const smtpPasswordCall = prisma.setting.upsert.mock.calls.find(
      ([call]) => call.where.key === 'smtp.password',
    );
    const smtpHostCall = prisma.setting.upsert.mock.calls.find(
      ([call]) => call.where.key === 'smtp.host',
    );

    expect(smtpPasswordCall?.[0].create.value).not.toBe('SMTP.NewSecret123');
    expect(smtpPasswordCall?.[0].create.value.startsWith('enc:v1:')).toBe(true);
    expect(decryptSettingValue(smtpPasswordCall?.[0].create.value, activeKey)).toBe('SMTP.NewSecret123');
    expect(smtpHostCall?.[0].create.value).toBe('smtp.demo.cl');
  });
});

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  decryptSettingValueWithSecrets,
  encryptSettingValue,
  isEncryptedSettingValue,
  resolveSettingsEncryptionSecrets,
} from './settings-encryption';

const SECRET_SETTING_KEYS = new Set(['smtp.password']);

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private getEncryptionSecrets() {
    return resolveSettingsEncryptionSecrets(
      this.configService.get<string>('SETTINGS_ENCRYPTION_KEY'),
      this.configService.get<string>('SETTINGS_ENCRYPTION_KEYS'),
    );
  }

  private getActiveEncryptionSecret() {
    return this.getEncryptionSecrets()[0] ?? null;
  }

  private encodeSettingValue(key: string, value: string) {
    if (!SECRET_SETTING_KEYS.has(key)) {
      return value;
    }

    if (value.trim().length === 0) {
      return '';
    }

    const encryptionSecret = this.getActiveEncryptionSecret();
    if (!encryptionSecret) {
      throw new InternalServerErrorException(
        'SETTINGS_ENCRYPTION_KEY o SETTINGS_ENCRYPTION_KEYS es requerido para persistir configuraciones sensibles',
      );
    }

    return encryptSettingValue(value, encryptionSecret);
  }

  private decodeSettingValue(key: string, value: string) {
    if (!SECRET_SETTING_KEYS.has(key)) {
      return value;
    }

    if (!isEncryptedSettingValue(value)) {
      return value;
    }

    const encryptionSecrets = this.getEncryptionSecrets();
    if (encryptionSecrets.length === 0) {
      throw new InternalServerErrorException(
        'SETTINGS_ENCRYPTION_KEY o SETTINGS_ENCRYPTION_KEYS es requerido para leer configuraciones sensibles cifradas',
      );
    }

    try {
      return decryptSettingValueWithSecrets(value, encryptionSecrets).value;
    } catch (error) {
      this.logger.error(`No se pudo descifrar la configuracion sensible ${key}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException(
        `No se pudo descifrar la configuracion sensible ${key}`,
      );
    }
  }

  private async normalizeSecretSettings<T extends { id: string; key: string; value: string }>(settings: T[]) {
    const encryptionSecrets = this.getEncryptionSecrets();
    const activeSecret = encryptionSecrets[0] ?? null;

    if (!activeSecret) {
      return settings;
    }

    return Promise.all(settings.map(async (setting) => {
      if (!SECRET_SETTING_KEYS.has(setting.key)) {
        return setting;
      }

      if (setting.value.trim().length === 0) {
        return setting;
      }

      if (!isEncryptedSettingValue(setting.value)) {
        const encryptedValue = encryptSettingValue(setting.value, activeSecret);
        await this.prisma.setting.update({
          where: { id: setting.id },
          data: { value: encryptedValue },
        });

        this.logger.log(`Configuracion sensible migrada a almacenamiento cifrado: ${setting.key}`);
        return { ...setting, value: encryptedValue };
      }

      try {
        const decryptedSetting = decryptSettingValueWithSecrets(setting.value, encryptionSecrets);
        if (!decryptedSetting.requiresRewrap) {
          return setting;
        }

        const rewrappedValue = encryptSettingValue(decryptedSetting.value, activeSecret);
        await this.prisma.setting.update({
          where: { id: setting.id },
          data: { value: rewrappedValue },
        });

        this.logger.log(`Configuracion sensible rotada a la clave activa: ${setting.key}`);
        return { ...setting, value: rewrappedValue };
      } catch (error) {
        this.logger.error(
          `No se pudo normalizar la configuracion sensible ${setting.key}`,
          error instanceof Error ? error.stack : undefined,
        );
        throw new InternalServerErrorException(
          `No se pudo normalizar la configuracion sensible ${setting.key}`,
        );
      }
    }));
  }

  private async getStoredSettings() {
    const settings = await this.prisma.setting.findMany();
    return this.normalizeSecretSettings(settings);
  }

  async getAll() {
    const settings = await this.getStoredSettings();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = this.decodeSettingValue(s.key, s.value);
    }
    return result;
  }

  async getAllAdminView() {
    const settings = await this.getStoredSettings();
    const result: Record<string, string> = {};
    let smtpPasswordConfigured = false;

    for (const s of settings) {
      if (SECRET_SETTING_KEYS.has(s.key)) {
        const secretValue = this.decodeSettingValue(s.key, s.value);
        if (s.key === 'smtp.password' && secretValue.trim().length > 0) {
          smtpPasswordConfigured = true;
        }
        continue;
      }

      result[s.key] = s.value;
    }

    result['smtp.passwordConfigured'] = smtpPasswordConfigured ? 'true' : 'false';
    return result;
  }

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) {
      return null;
    }

    const [normalizedSetting] = await this.normalizeSecretSettings([setting]);
    return this.decodeSettingValue(normalizedSetting.key, normalizedSetting.value);
  }

  async set(key: string, value: string) {
    const storedValue = this.encodeSettingValue(key, value);
    return this.prisma.setting.upsert({
      where: { key },
      update: { value: storedValue },
      create: { key, value: storedValue },
    });
  }

  async setMany(data: Record<string, string>) {
    const operations = Object.entries(data).map(([key, value]) =>
      {
        const storedValue = this.encodeSettingValue(key, value);
        return this.prisma.setting.upsert({
          where: { key },
          update: { value: storedValue },
          create: { key, value: storedValue },
        });
      },
    );
    return this.prisma.$transaction(operations);
  }

  async updateWithAudit(data: Record<string, string>, userId: string, auditService: AuditService) {
    const updatedKeys = Object.keys(data);

    return this.prisma.$transaction(async (tx) => {
      const operations = Object.entries(data).map(([key, value]) => {
        const storedValue = this.encodeSettingValue(key, value);
        return tx.setting.upsert({
          where: { key },
          update: { value: storedValue },
          create: { key, value: storedValue },
        });
      });

      const result = await Promise.all(operations);

      await auditService.log(
        {
          entityType: 'Setting',
          entityId: 'global',
          userId,
          action: 'UPDATE',
          diff: { updatedKeys },
        },
        tx,
      );

      return result;
    });
  }

  async delete(key: string) {
    return this.prisma.setting.deleteMany({ where: { key } });
  }
}

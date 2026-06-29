import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  decryptSettingValueWithSecrets,
  encryptSettingValue,
  isEncryptedSettingValue,
  resolveSettingsEncryptionSecrets,
} from '../settings/settings-encryption';

function getTotpEncryptionSecrets(configService: ConfigService) {
  return resolveSettingsEncryptionSecrets(
    configService.get<string>('SETTINGS_ENCRYPTION_KEY'),
    configService.get<string>('SETTINGS_ENCRYPTION_KEYS'),
  );
}

export function encryptStoredTotpSecret(secret: string, configService: ConfigService) {
  const activeSecret = getTotpEncryptionSecrets(configService)[0] ?? null;
  if (!activeSecret) {
    throw new InternalServerErrorException(
      'SETTINGS_ENCRYPTION_KEY o SETTINGS_ENCRYPTION_KEYS es requerido para proteger la semilla TOTP',
    );
  }

  return encryptSettingValue(secret, activeSecret);
}

export function decryptStoredTotpSecret(secret: string, configService: ConfigService) {
  if (!isEncryptedSettingValue(secret)) {
    return secret;
  }

  const secrets = getTotpEncryptionSecrets(configService);
  if (secrets.length === 0) {
    throw new InternalServerErrorException(
      'SETTINGS_ENCRYPTION_KEY o SETTINGS_ENCRYPTION_KEYS es requerido para leer la semilla TOTP',
    );
  }

  try {
    return decryptSettingValueWithSecrets(secret, secrets).value;
  } catch {
    throw new InternalServerErrorException('No se pudo descifrar la semilla TOTP');
  }
}

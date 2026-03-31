import {
  decryptSettingValue,
  decryptSettingValueWithSecrets,
  encryptSettingValue,
  isEncryptedSettingValue,
  resolveSettingsEncryptionSecrets,
} from './settings-encryption';

describe('settings-encryption', () => {
  const encryptionSecret = '0123456789abcdef0123456789abcdef';
  const rotatedSecret = 'fedcba9876543210fedcba9876543210';

  it('encrypts and decrypts a value using authenticated encryption', () => {
    const encrypted = encryptSettingValue('SMTP.SuperSecret123', encryptionSecret);

    expect(isEncryptedSettingValue(encrypted)).toBe(true);
    expect(encrypted).not.toBe('SMTP.SuperSecret123');
    expect(decryptSettingValue(encrypted, encryptionSecret)).toBe('SMTP.SuperSecret123');
  });

  it('returns plaintext values as-is when they were never encrypted', () => {
    expect(isEncryptedSettingValue('legacy-plaintext')).toBe(false);
    expect(decryptSettingValue('legacy-plaintext', encryptionSecret)).toBe('legacy-plaintext');
  });

  it('fails to decrypt when the secret key is different', () => {
    const encrypted = encryptSettingValue('SMTP.SuperSecret123', encryptionSecret);

    expect(() => decryptSettingValue(encrypted, 'different-secret-key-0123456789abcdef')).toThrow();
  });

  it('tries a configured key ring and reports when rewrap is needed', () => {
    const encryptedWithOldKey = encryptSettingValue('SMTP.SuperSecret123', rotatedSecret);

    expect(
      decryptSettingValueWithSecrets(encryptedWithOldKey, [encryptionSecret, rotatedSecret]),
    ).toEqual({
      value: 'SMTP.SuperSecret123',
      usedSecret: rotatedSecret,
      requiresRewrap: true,
    });
  });

  it('resolves the active secret and deduplicates the key ring', () => {
    expect(
      resolveSettingsEncryptionSecrets(
        encryptionSecret,
        `${rotatedSecret}, ${encryptionSecret}, , ${rotatedSecret}`,
      ),
    ).toEqual([encryptionSecret, rotatedSecret]);
  });
});

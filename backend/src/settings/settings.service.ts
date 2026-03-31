import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SECRET_SETTING_KEYS = new Set(['smtp.password']);

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    const settings = await this.prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async getAllAdminView() {
    const settings = await this.prisma.setting.findMany();
    const result: Record<string, string> = {};
    let smtpPasswordConfigured = false;

    for (const s of settings) {
      if (SECRET_SETTING_KEYS.has(s.key)) {
        if (s.key === 'smtp.password' && s.value.trim().length > 0) {
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
    return setting?.value ?? null;
  }

  async set(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async setMany(data: Record<string, string>) {
    const operations = Object.entries(data).map(([key, value]) =>
      this.prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    );
    return this.prisma.$transaction(operations);
  }

  async delete(key: string) {
    return this.prisma.setting.deleteMany({ where: { key } });
  }
}

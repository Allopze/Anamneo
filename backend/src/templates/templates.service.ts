import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async findByMedico(medicoId: string) {
    return this.prisma.textTemplate.findMany({
      where: { medicoId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(medicoId: string, data: { name: string; category?: string; content: string; sectionKey?: string }) {
    return this.prisma.textTemplate.create({
      data: { ...data, category: data.category || 'GENERAL', medicoId },
    });
  }

  async update(id: string, medicoId: string, data: { name?: string; category?: string; content?: string; sectionKey?: string }) {
    const template = await this.prisma.textTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.medicoId !== medicoId) throw new ForbiddenException('No tiene permisos para editar esta plantilla');

    return this.prisma.textTemplate.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, medicoId: string) {
    const template = await this.prisma.textTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.medicoId !== medicoId) throw new ForbiddenException('No tiene permisos para eliminar esta plantilla');

    return this.prisma.textTemplate.delete({ where: { id } });
  }
}

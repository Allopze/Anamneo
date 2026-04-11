import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const DEFAULT_TEMPLATE_PACK = [
  {
    name: 'Control crónico breve',
    category: 'CONTROL_CRONICO',
    sectionKey: 'ANAMNESIS_PROXIMA',
    content:
      'Paciente en control crónico. Refiere adherencia parcial/completa al tratamiento. Sin efectos adversos relevantes. Evaluar metas, adherencia y necesidad de ajustes.',
  },
  {
    name: 'Plan de seguimiento estándar',
    category: 'GENERAL',
    sectionKey: 'RESPUESTA_TRATAMIENTO',
    content:
      'Control en 2 a 4 semanas según evolución. Reconsultar antes en caso de empeoramiento, fiebre persistente, dolor progresivo o aparición de signos de alarma.',
  },
  {
    name: 'Derivación a especialista',
    category: 'DERIVACION',
    sectionKey: 'TRATAMIENTO',
    content:
      'Se deriva a especialista para evaluación complementaria. Adjuntar antecedentes clínicos relevantes, tratamientos previos y exámenes disponibles.',
  },
  {
    name: 'Observación clínica breve',
    category: 'GENERAL',
    sectionKey: 'OBSERVACIONES',
    content:
      'Paciente comprende indicaciones y signos de alarma. Se explican riesgos, beneficios y plan de seguimiento.',
  },
  {
    name: 'SOAP breve',
    category: 'SOAP',
    sectionKey: 'OBSERVACIONES',
    content:
      'S: \nO: \nA: \nP: ',
  },
];

@Injectable()
export class TemplatesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findByMedico(medicoId: string) {
    return this.prisma.textTemplate.findMany({
      where: { medicoId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(medicoId: string, userId: string, data: { name: string; category?: string; content: string; sectionKey?: string }) {
    const template = await this.prisma.textTemplate.create({
      data: { ...data, category: data.category || 'GENERAL', medicoId },
    });

    await this.auditService.log({
      entityType: 'TextTemplate',
      entityId: template.id,
      userId,
      action: 'CREATE',
      diff: { created: { id: template.id, name: template.name, category: template.category, sectionKey: template.sectionKey } },
    });

    return template;
  }

  async update(id: string, medicoId: string, userId: string, data: { name?: string; category?: string; content?: string; sectionKey?: string }) {
    const template = await this.prisma.textTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.medicoId !== medicoId) throw new ForbiddenException('No tiene permisos para editar esta plantilla');

    const updated = await this.prisma.textTemplate.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      entityType: 'TextTemplate',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: { before: { name: template.name, category: template.category, content: template.content, sectionKey: template.sectionKey }, after: data },
    });

    return updated;
  }

  async delete(id: string, medicoId: string, userId: string) {
    const template = await this.prisma.textTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.medicoId !== medicoId) throw new ForbiddenException('No tiene permisos para eliminar esta plantilla');

    await this.prisma.textTemplate.delete({ where: { id } });

    await this.auditService.log({
      entityType: 'TextTemplate',
      entityId: id,
      userId,
      action: 'DELETE',
      diff: { deleted: { id: template.id, name: template.name, category: template.category, sectionKey: template.sectionKey } },
    });

    return template;
  }

  async installDefaultPack(medicoId: string) {
    const existing = await this.prisma.textTemplate.findMany({
      where: { medicoId },
      select: { name: true, sectionKey: true },
    });

    const existingKeys = new Set(existing.map((item) => `${item.name}::${item.sectionKey || ''}`));
    const toCreate = DEFAULT_TEMPLATE_PACK.filter(
      (template) => !existingKeys.has(`${template.name}::${template.sectionKey || ''}`),
    );

    if (toCreate.length === 0) {
      return { created: 0 };
    }

    await this.prisma.textTemplate.createMany({
      data: toCreate.map((template) => ({
        medicoId,
        ...template,
      })),
    });

    return { created: toCreate.length };
  }
}

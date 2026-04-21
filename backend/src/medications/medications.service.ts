import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import {
  normalizeMedicationName,
  normalizeMedicationSearchValue,
  toMedicationResponse,
} from './medications-helpers';

@Injectable()
export class MedicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateMedicationDto) {
    const normalizedName = normalizeMedicationName(createDto.name);
    await this.assertNameAvailable(normalizedName);

    const medication = await this.prisma.medicationCatalog.create({
      data: {
        name: createDto.name,
        normalizedName,
        activeIngredient: createDto.activeIngredient,
        ...(createDto.defaultDose !== undefined ? { defaultDose: createDto.defaultDose } : {}),
        ...(createDto.defaultRoute !== undefined ? { defaultRoute: createDto.defaultRoute } : {}),
        ...(createDto.defaultFrequency !== undefined ? { defaultFrequency: createDto.defaultFrequency } : {}),
      },
    });

    return toMedicationResponse(medication);
  }

  async findAll(search: string | undefined, user: CurrentUserData) {
    const medications = await this.prisma.medicationCatalog.findMany({
      where: user?.isAdmin ? undefined : { active: true },
      orderBy: { name: 'asc' },
    });

    const normalizedSearch = search?.trim()
      ? normalizeMedicationSearchValue(search)
      : null;

    const filtered = normalizedSearch
      ? medications.filter((medication) => {
          const name = medication.normalizedName || normalizeMedicationName(medication.name);
          const activeIngredient = normalizeMedicationSearchValue(medication.activeIngredient);
          return name.includes(normalizedSearch) || activeIngredient.includes(normalizedSearch);
        })
      : medications;

    return filtered.map(toMedicationResponse);
  }

  async findById(id: string) {
    const medication = await this.prisma.medicationCatalog.findUnique({
      where: { id },
    });

    if (!medication) {
      throw new NotFoundException('Medicamento no encontrado');
    }

    return toMedicationResponse(medication);
  }

  async update(id: string, updateDto: UpdateMedicationDto) {
    const medication = await this.prisma.medicationCatalog.findUnique({
      where: { id },
    });

    if (!medication) {
      throw new NotFoundException('Medicamento no encontrado');
    }

    const updateData: Record<string, unknown> = {};
    if (updateDto.name) {
      const normalizedName = normalizeMedicationName(updateDto.name);
      await this.assertNameAvailable(normalizedName, id);
      updateData.name = updateDto.name;
      updateData.normalizedName = normalizedName;
    }
    if (updateDto.activeIngredient) {
      updateData.activeIngredient = updateDto.activeIngredient;
    }
    if (updateDto.defaultDose !== undefined) {
      updateData.defaultDose = updateDto.defaultDose;
    }
    if (updateDto.defaultRoute !== undefined) {
      updateData.defaultRoute = updateDto.defaultRoute;
    }
    if (updateDto.defaultFrequency !== undefined) {
      updateData.defaultFrequency = updateDto.defaultFrequency;
    }
    if (updateDto.active !== undefined) {
      updateData.active = updateDto.active;
    }

    const updated = await this.prisma.medicationCatalog.update({
      where: { id },
      data: updateData,
    });

    return toMedicationResponse(updated);
  }

  async remove(id: string) {
    const medication = await this.prisma.medicationCatalog.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!medication) {
      throw new NotFoundException('Medicamento no encontrado');
    }

    await this.prisma.medicationCatalog.update({
      where: { id },
      data: { active: false },
    });

    return { message: 'Medicamento eliminado correctamente' };
  }

  private async assertNameAvailable(normalizedName: string, excludeId?: string) {
    const existing = await this.prisma.medicationCatalog.findFirst({
      where: {
        normalizedName,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Ya existe un medicamento global con ese nombre');
    }
  }
}
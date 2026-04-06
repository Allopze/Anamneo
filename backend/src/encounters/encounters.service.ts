import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { PREVISIONES, SEXOS, SectionKey, EncounterStatus } from '../common/types';
import { getEffectiveMedicoId, RequestUser } from '../common/utils/medico-id';
import { parseStoredJson } from '../common/utils/encounter-sections';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import {
  PATIENT_HISTORY_FIELD_KEYS,
  sanitizePatientHistoryFieldValue,
  sanitizePatientHistoryPayload,
} from '../common/utils/patient-history';
import { isDateOnlyBeforeToday } from '../common/utils/local-date';
import {
  ENCOUNTER_SECTION_LABELS as SECTION_LABELS,
  ENCOUNTER_SECTION_ORDER as SECTION_ORDER,
  getEncounterSectionSchemaVersion,
} from '../common/utils/encounter-section-meta';

const REQUIRED_COMPLETION_SECTIONS: SectionKey[] = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

const REQUIRED_SEMANTIC_SECTIONS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

const IDENTIFICATION_SNAPSHOT_FIELD_META = [
  { key: 'nombre', label: 'nombre' },
  { key: 'rut', label: 'RUT' },
  { key: 'rutExempt', label: 'exención de RUT' },
  { key: 'rutExemptReason', label: 'motivo de exención' },
  { key: 'edad', label: 'edad' },
  { key: 'edadMeses', label: 'edad (meses)' },
  { key: 'sexo', label: 'sexo' },
  { key: 'prevision', label: 'previsión' },
  { key: 'trabajo', label: 'trabajo' },
  { key: 'domicilio', label: 'domicilio' },
] as const;

const ORDER_STATUSES = ['PENDIENTE', 'RECIBIDO', 'REVISADO'] as const;
const CHOSEN_MODES = ['AUTO', 'MANUAL'] as const;
const REVIEW_NOTE_MIN_LENGTH = 10;
const CLOSURE_NOTE_MIN_LENGTH = 15;
const REVISION_SISTEMAS_KEYS = [
  'psiquico',
  'cabeza',
  'cuello',
  'columna',
  'musculoArticulaciones',
  'piel',
  'respiratorio',
  'cardiovascular',
  'gastrointestinal',
  'genitourinario',
  'neurologico',
  'ginecologico',
] as const;

function parseSectionData(rawData: unknown): unknown {
  return parseStoredJson(rawData, null);
}

function hasMeaningfulContent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulContent(item));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => hasMeaningfulContent(item));
  }

  return false;
}

@Injectable()
export class EncountersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private formatTask(task: any) {
    return {
      ...task,
      createdBy: task.createdBy ? { id: task.createdBy.id, nombre: task.createdBy.nombre } : undefined,
    };
  }

  private sanitizeText(value: unknown, maxLength: number) {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('La sección contiene campos de texto inválidos');
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    return trimmed.slice(0, maxLength);
  }

  private summarizeSectionAuditData(sectionKey: SectionKey, data: unknown, completed?: boolean) {
    const topLevelKeys = typeof data === 'object' && data !== null && !Array.isArray(data)
      ? Object.keys(data as Record<string, unknown>)
      : [];

    return {
      sectionKey,
      schemaVersion: getEncounterSectionSchemaVersion(sectionKey),
      completed,
      topLevelKeys,
      fieldCount: topLevelKeys.length,
      redacted: true,
    };
  }

  private summarizeWorkflowNoteAudit(note: string | null | undefined) {
    if (!note) {
      return null;
    }

    return {
      redacted: true,
      provided: true,
      length: note.length,
    };
  }

  private sanitizeRequiredWorkflowNote(value: unknown, label: string, minLength: number, maxLength: number) {
    const sanitized = this.sanitizeText(value, maxLength);
    if (!sanitized || sanitized.length < minLength) {
      throw new BadRequestException(`${label} debe tener al menos ${minLength} caracteres`);
    }

    return sanitized;
  }

  private sanitizeTextListField(value: unknown, maxLength: number) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const sanitized = this.sanitizeText(value, maxLength);
    return sanitized === undefined ? undefined : sanitized;
  }

  private sanitizeNumericStringField(
    value: unknown,
    label: string,
    min: number,
    max: number,
  ) {
    const sanitized = this.sanitizeTextListField(value, 32);
    if (sanitized === undefined) {
      return undefined;
    }

    const parsed = Number.parseFloat(sanitized.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`${label} debe estar entre ${min} y ${max}`);
    }

    return String(parsed);
  }

  private sanitizePressureField(value: unknown) {
    const sanitized = this.sanitizeTextListField(value, 16);
    if (sanitized === undefined) {
      return undefined;
    }

    if (!/^\d{2,3}\/\d{2,3}$/.test(sanitized)) {
      throw new BadRequestException('La presión arterial debe tener formato 120/80');
    }

    return sanitized;
  }

  private sanitizeStructuredMedication(
    item: unknown,
    index: number,
  ) {
    if (typeof item !== 'object' || item === null) {
      throw new BadRequestException(`Medicamento estructurado #${index + 1} inválido`);
    }

    const record = item as Record<string, unknown>;
    const id = this.sanitizeText(record.id, 100);
    if (!id) {
      throw new BadRequestException(`Medicamento estructurado #${index + 1} requiere id`);
    }

    const nombre = this.sanitizeTextListField(record.nombre, 200);
    const dosis = this.sanitizeTextListField(record.dosis, 120);
    const frecuencia = this.sanitizeTextListField(record.frecuencia, 120);
    const duracion = this.sanitizeTextListField(record.duracion, 120);
    const indicacion = this.sanitizeTextListField(record.indicacion, 400);

    if (!nombre && !dosis && !frecuencia && !duracion && !indicacion) {
      return null;
    }

    return {
      id,
      ...(nombre !== undefined ? { nombre } : {}),
      ...(dosis !== undefined ? { dosis } : {}),
      ...(frecuencia !== undefined ? { frecuencia } : {}),
      ...(duracion !== undefined ? { duracion } : {}),
      ...(indicacion !== undefined ? { indicacion } : {}),
    };
  }

  private sanitizeStructuredOrder(
    item: unknown,
    index: number,
    label: 'examen' | 'derivación',
  ) {
    if (typeof item !== 'object' || item === null) {
      throw new BadRequestException(`${label} estructurado #${index + 1} inválido`);
    }

    const record = item as Record<string, unknown>;
    const id = this.sanitizeText(record.id, 100);
    if (!id) {
      throw new BadRequestException(`${label} estructurado #${index + 1} requiere id`);
    }

    const nombre = this.sanitizeTextListField(record.nombre, 200);
    const indicacion = this.sanitizeTextListField(record.indicacion, 400);
    const resultado = this.sanitizeTextListField(record.resultado, 1000);
    const estado = (() => {
      if (record.estado === undefined || record.estado === null || record.estado === '') {
        return 'PENDIENTE';
      }

      if (typeof record.estado !== 'string' || !ORDER_STATUSES.includes(record.estado as typeof ORDER_STATUSES[number])) {
        throw new BadRequestException(`El estado del ${label} estructurado #${index + 1} no es válido`);
      }

      return record.estado;
    })();

    if (!nombre && !indicacion && !resultado) {
      return null;
    }

    return {
      id,
      ...(nombre !== undefined ? { nombre } : {}),
      ...(indicacion !== undefined ? { indicacion } : {}),
      estado,
      ...(resultado !== undefined ? { resultado } : {}),
    };
  }

  private sanitizeExamenFisicoData(data: Record<string, unknown>) {
    const signosVitalesRaw = data.signosVitales;
    let signosVitales: Record<string, string> | undefined;

    if (signosVitalesRaw !== undefined && signosVitalesRaw !== null) {
      if (typeof signosVitalesRaw !== 'object' || Array.isArray(signosVitalesRaw)) {
        throw new BadRequestException('Los signos vitales deben enviarse como objeto');
      }

      const raw = signosVitalesRaw as Record<string, unknown>;
      const peso = this.sanitizeNumericStringField(raw.peso, 'El peso', 0.5, 500);
      const talla = this.sanitizeNumericStringField(raw.talla, 'La talla', 20, 250);
      const recomputedImc = (() => {
        if (!peso || !talla) {
          return undefined;
        }

        const tallaMetros = Number.parseFloat(talla) / 100;
        if (!Number.isFinite(tallaMetros) || tallaMetros <= 0) {
          return undefined;
        }

        const value = Number.parseFloat(peso) / (tallaMetros * tallaMetros);
        return value.toFixed(1);
      })();

      signosVitales = {
        ...(this.sanitizePressureField(raw.presionArterial) !== undefined
          ? { presionArterial: this.sanitizePressureField(raw.presionArterial)! }
          : {}),
        ...(this.sanitizeNumericStringField(raw.frecuenciaCardiaca, 'La frecuencia cardiaca', 20, 250) !== undefined
          ? { frecuenciaCardiaca: this.sanitizeNumericStringField(raw.frecuenciaCardiaca, 'La frecuencia cardiaca', 20, 250)! }
          : {}),
        ...(this.sanitizeNumericStringField(raw.frecuenciaRespiratoria, 'La frecuencia respiratoria', 5, 60) !== undefined
          ? { frecuenciaRespiratoria: this.sanitizeNumericStringField(raw.frecuenciaRespiratoria, 'La frecuencia respiratoria', 5, 60)! }
          : {}),
        ...(this.sanitizeNumericStringField(raw.temperatura, 'La temperatura', 35, 42) !== undefined
          ? { temperatura: this.sanitizeNumericStringField(raw.temperatura, 'La temperatura', 35, 42)! }
          : {}),
        ...(this.sanitizeNumericStringField(raw.saturacionOxigeno, 'La saturación de oxígeno', 0, 100) !== undefined
          ? { saturacionOxigeno: this.sanitizeNumericStringField(raw.saturacionOxigeno, 'La saturación de oxígeno', 0, 100)! }
          : {}),
        ...(peso !== undefined ? { peso } : {}),
        ...(talla !== undefined ? { talla } : {}),
        ...(recomputedImc !== undefined ? { imc: recomputedImc } : {}),
      };

      if (Object.keys(signosVitales).length === 0) {
        signosVitales = undefined;
      }
    }

    return {
      ...(signosVitales ? { signosVitales } : {}),
      ...(this.sanitizeTextListField(data.cabeza, 2000) !== undefined ? { cabeza: this.sanitizeTextListField(data.cabeza, 2000) } : {}),
      ...(this.sanitizeTextListField(data.cuello, 2000) !== undefined ? { cuello: this.sanitizeTextListField(data.cuello, 2000) } : {}),
      ...(this.sanitizeTextListField(data.torax, 2000) !== undefined ? { torax: this.sanitizeTextListField(data.torax, 2000) } : {}),
      ...(this.sanitizeTextListField(data.abdomen, 2000) !== undefined ? { abdomen: this.sanitizeTextListField(data.abdomen, 2000) } : {}),
      ...(this.sanitizeTextListField(data.extremidades, 2000) !== undefined ? { extremidades: this.sanitizeTextListField(data.extremidades, 2000) } : {}),
    };
  }

  private sanitizeTratamientoData(data: Record<string, unknown>) {
    const medicamentos = (() => {
      if (data.medicamentosEstructurados === undefined || data.medicamentosEstructurados === null) {
        return undefined;
      }

      if (!Array.isArray(data.medicamentosEstructurados)) {
        throw new BadRequestException('Los medicamentos estructurados deben enviarse como arreglo');
      }

      return data.medicamentosEstructurados
        .slice(0, 100)
        .map((item, index) => this.sanitizeStructuredMedication(item, index))
        .filter((item): item is NonNullable<typeof item> => item !== null);
    })();

    const examenes = (() => {
      if (data.examenesEstructurados === undefined || data.examenesEstructurados === null) {
        return undefined;
      }

      if (!Array.isArray(data.examenesEstructurados)) {
        throw new BadRequestException('Los exámenes estructurados deben enviarse como arreglo');
      }

      return data.examenesEstructurados
        .slice(0, 100)
        .map((item, index) => this.sanitizeStructuredOrder(item, index, 'examen'))
        .filter((item): item is NonNullable<typeof item> => item !== null);
    })();

    const derivaciones = (() => {
      if (data.derivacionesEstructuradas === undefined || data.derivacionesEstructuradas === null) {
        return undefined;
      }

      if (!Array.isArray(data.derivacionesEstructuradas)) {
        throw new BadRequestException('Las derivaciones estructuradas deben enviarse como arreglo');
      }

      return data.derivacionesEstructuradas
        .slice(0, 100)
        .map((item, index) => this.sanitizeStructuredOrder(item, index, 'derivación'))
        .filter((item): item is NonNullable<typeof item> => item !== null);
    })();

    return {
      ...(this.sanitizeTextListField(data.plan, 4000) !== undefined ? { plan: this.sanitizeTextListField(data.plan, 4000) } : {}),
      ...(this.sanitizeTextListField(data.indicaciones, 4000) !== undefined ? { indicaciones: this.sanitizeTextListField(data.indicaciones, 4000) } : {}),
      ...(this.sanitizeTextListField(data.receta, 4000) !== undefined ? { receta: this.sanitizeTextListField(data.receta, 4000) } : {}),
      ...(this.sanitizeTextListField(data.examenes, 3000) !== undefined ? { examenes: this.sanitizeTextListField(data.examenes, 3000) } : {}),
      ...(this.sanitizeTextListField(data.derivaciones, 3000) !== undefined ? { derivaciones: this.sanitizeTextListField(data.derivaciones, 3000) } : {}),
      ...(medicamentos !== undefined ? { medicamentosEstructurados: medicamentos } : {}),
      ...(examenes !== undefined ? { examenesEstructurados: examenes } : {}),
      ...(derivaciones !== undefined ? { derivacionesEstructuradas: derivaciones } : {}),
    };
  }

  private sanitizeRespuestaTratamientoData(data: Record<string, unknown>) {
    return {
      ...(this.sanitizeTextListField(data.evolucion, 4000) !== undefined ? { evolucion: this.sanitizeTextListField(data.evolucion, 4000) } : {}),
      ...(this.sanitizeTextListField(data.resultadosExamenes, 4000) !== undefined ? { resultadosExamenes: this.sanitizeTextListField(data.resultadosExamenes, 4000) } : {}),
      ...(this.sanitizeTextListField(data.ajustesTratamiento, 4000) !== undefined ? { ajustesTratamiento: this.sanitizeTextListField(data.ajustesTratamiento, 4000) } : {}),
      ...(this.sanitizeTextListField(data.planSeguimiento, 4000) !== undefined ? { planSeguimiento: this.sanitizeTextListField(data.planSeguimiento, 4000) } : {}),
    };
  }

  private sanitizeMotivoConsultaData(data: Record<string, unknown>) {
    const afeccionSeleccionada = (() => {
      const raw = data.afeccionSeleccionada;
      if (raw === undefined || raw === null) {
        return undefined;
      }

      if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new BadRequestException('La afección seleccionada no es válida');
      }

      const record = raw as Record<string, unknown>;
      const id = this.sanitizeText(record.id, 100);
      const name = this.sanitizeText(record.name, 200);
      if (!id || !name) {
        throw new BadRequestException('La afección seleccionada requiere id y nombre');
      }

      const confidence =
        record.confidence === undefined || record.confidence === null || record.confidence === ''
          ? undefined
          : Number(record.confidence);

      if (confidence !== undefined && (!Number.isFinite(confidence) || confidence < 0 || confidence > 100)) {
        throw new BadRequestException('La confianza de la afección seleccionada debe estar entre 0 y 100');
      }

      return {
        id,
        name,
        ...(confidence !== undefined ? { confidence } : {}),
      };
    })();

    const modoSeleccion = (() => {
      if (data.modoSeleccion === undefined || data.modoSeleccion === null || data.modoSeleccion === '') {
        return undefined;
      }

      if (typeof data.modoSeleccion !== 'string' || !CHOSEN_MODES.includes(data.modoSeleccion as typeof CHOSEN_MODES[number])) {
        throw new BadRequestException('El modo de selección del motivo de consulta no es válido');
      }

      return data.modoSeleccion;
    })();

    return {
      ...(this.sanitizeTextListField(data.texto, 4000) !== undefined ? { texto: this.sanitizeTextListField(data.texto, 4000) } : {}),
      ...(afeccionSeleccionada !== undefined ? { afeccionSeleccionada } : {}),
      ...(modoSeleccion !== undefined ? { modoSeleccion } : {}),
    };
  }

  private sanitizeAnamnesisProximaData(data: Record<string, unknown>) {
    return {
      ...(this.sanitizeTextListField(data.relatoAmpliado, 5000) !== undefined ? { relatoAmpliado: this.sanitizeTextListField(data.relatoAmpliado, 5000) } : {}),
      ...(this.sanitizeTextListField(data.inicio, 300) !== undefined ? { inicio: this.sanitizeTextListField(data.inicio, 300) } : {}),
      ...(this.sanitizeTextListField(data.evolucion, 300) !== undefined ? { evolucion: this.sanitizeTextListField(data.evolucion, 300) } : {}),
      ...(this.sanitizeTextListField(data.factoresAgravantes, 2000) !== undefined ? { factoresAgravantes: this.sanitizeTextListField(data.factoresAgravantes, 2000) } : {}),
      ...(this.sanitizeTextListField(data.factoresAtenuantes, 2000) !== undefined ? { factoresAtenuantes: this.sanitizeTextListField(data.factoresAtenuantes, 2000) } : {}),
      ...(this.sanitizeTextListField(data.sintomasAsociados, 3000) !== undefined ? { sintomasAsociados: this.sanitizeTextListField(data.sintomasAsociados, 3000) } : {}),
    };
  }

  private sanitizeAnamnesisRemotaData(data: Record<string, unknown>) {
    return sanitizePatientHistoryPayload(data, {
      allowString: true,
      allowReadonly: true,
      rejectUnknownKeys: true,
    });
  }

  private sanitizeRevisionSistemasData(data: Record<string, unknown>) {
    const sanitized: Record<string, unknown> = {};

    for (const key of REVISION_SISTEMAS_KEYS) {
      const raw = data[key];
      if (raw === undefined || raw === null) {
        continue;
      }

      if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new BadRequestException(`El sistema ${key} debe enviarse como objeto`);
      }

      const record = raw as Record<string, unknown>;
      if (record.checked !== undefined && typeof record.checked !== 'boolean') {
        throw new BadRequestException(`El campo checked de ${key} no es válido`);
      }

      const notas = this.sanitizeTextListField(record.notas, 1200);
      const checked = record.checked === true;

      if (!checked && notas === undefined) {
        continue;
      }

      sanitized[key] = {
        checked,
        notas: notas ?? '',
      };
    }

    return sanitized;
  }

  private sanitizeSospechaDiagnosticaData(data: Record<string, unknown>) {
    if (data.sospechas === undefined || data.sospechas === null) {
      return {};
    }

    if (!Array.isArray(data.sospechas)) {
      throw new BadRequestException('Las sospechas diagnósticas deben enviarse como arreglo');
    }

    const sospechas = data.sospechas
      .slice(0, 20)
      .map((item, index) => {
        if (typeof item !== 'object' || item === null) {
          throw new BadRequestException(`Sospecha diagnóstica #${index + 1} inválida`);
        }

        const record = item as Record<string, unknown>;
        const id = this.sanitizeText(record.id, 100);
        if (!id) {
          throw new BadRequestException(`Sospecha diagnóstica #${index + 1} requiere id`);
        }

        const diagnostico = this.sanitizeTextListField(record.diagnostico, 300);
        const notas = this.sanitizeTextListField(record.notas, 1200);

        if (!diagnostico && !notas) {
          return null;
        }

        return {
          id,
          diagnostico: diagnostico ?? '',
          prioridad: index + 1,
          notas: notas ?? '',
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      sospechas,
    };
  }

  private sanitizeObservacionesData(data: Record<string, unknown>) {
    return {
      ...(this.sanitizeTextListField(data.observaciones, 5000) !== undefined ? { observaciones: this.sanitizeTextListField(data.observaciones, 5000) } : {}),
      ...(this.sanitizeTextListField(data.notasInternas, 3000) !== undefined ? { notasInternas: this.sanitizeTextListField(data.notasInternas, 3000) } : {}),
      ...(this.sanitizeTextListField(data.resumenClinico, 5000) !== undefined ? { resumenClinico: this.sanitizeTextListField(data.resumenClinico, 5000) } : {}),
    };
  }

  private sanitizeIdentificacionData(data: Record<string, unknown>) {
    const normalizedEdad = (() => {
      const edad = data.edad;

      if (edad === undefined || edad === null || edad === '') {
        return undefined;
      }

      const parsed =
        typeof edad === 'number'
          ? edad
          : typeof edad === 'string'
            ? Number.parseInt(edad, 10)
            : Number.NaN;

      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 130) {
        throw new BadRequestException('La edad en identificación debe ser un número entero entre 0 y 130');
      }

      return parsed;
    })();

    const normalizedSexo = (() => {
      if (data.sexo === undefined || data.sexo === null || data.sexo === '') {
        return undefined;
      }

      if (typeof data.sexo !== 'string' || !SEXOS.includes(data.sexo as typeof SEXOS[number])) {
        throw new BadRequestException('El sexo en identificación no es válido');
      }

      return data.sexo;
    })();

    const normalizedPrevision = (() => {
      if (data.prevision === undefined || data.prevision === null || data.prevision === '') {
        return undefined;
      }

      if (typeof data.prevision !== 'string' || !PREVISIONES.includes(data.prevision as typeof PREVISIONES[number])) {
        throw new BadRequestException('La previsión en identificación no es válida');
      }

      return data.prevision;
    })();

    if (
      data.rutExempt !== undefined
      && data.rutExempt !== null
      && typeof data.rutExempt !== 'boolean'
    ) {
      throw new BadRequestException('El indicador de exención de RUT no es válido');
    }

    const rut = this.sanitizeText(data.rut, 32);
    const rutExemptReason = this.sanitizeText(data.rutExemptReason, 200);
    const nombre = this.sanitizeText(data.nombre, 200);
    const trabajo = this.sanitizeText(data.trabajo, 200);
    const domicilio = this.sanitizeText(data.domicilio, 300);

    return {
      ...(rut !== undefined ? { rut } : {}),
      ...(typeof data.rutExempt === 'boolean' ? { rutExempt: data.rutExempt } : {}),
      ...(rutExemptReason !== undefined ? { rutExemptReason } : {}),
      ...(nombre !== undefined ? { nombre } : {}),
      ...(normalizedEdad !== undefined ? { edad: normalizedEdad } : {}),
      ...(normalizedSexo !== undefined ? { sexo: normalizedSexo } : {}),
      ...(trabajo !== undefined ? { trabajo } : {}),
      ...(normalizedPrevision !== undefined ? { prevision: normalizedPrevision } : {}),
      ...(domicilio !== undefined ? { domicilio } : {}),
    };
  }

  private sanitizeSectionData(sectionKey: SectionKey, data: Record<string, unknown>) {
    if (sectionKey === 'IDENTIFICACION') {
      return this.sanitizeIdentificacionData(data);
    }

    if (sectionKey === 'MOTIVO_CONSULTA') {
      return this.sanitizeMotivoConsultaData(data);
    }

    if (sectionKey === 'ANAMNESIS_PROXIMA') {
      return this.sanitizeAnamnesisProximaData(data);
    }

    if (sectionKey === 'ANAMNESIS_REMOTA') {
      return this.sanitizeAnamnesisRemotaData(data);
    }

    if (sectionKey === 'REVISION_SISTEMAS') {
      return this.sanitizeRevisionSistemasData(data);
    }

    if (sectionKey === 'EXAMEN_FISICO') {
      return this.sanitizeExamenFisicoData(data);
    }

    if (sectionKey === 'SOSPECHA_DIAGNOSTICA') {
      return this.sanitizeSospechaDiagnosticaData(data);
    }

    if (sectionKey === 'TRATAMIENTO') {
      return this.sanitizeTratamientoData(data);
    }

    if (sectionKey === 'RESPUESTA_TRATAMIENTO') {
      return this.sanitizeRespuestaTratamientoData(data);
    }

    if (sectionKey === 'OBSERVACIONES') {
      return this.sanitizeObservacionesData(data);
    }

    return data;
  }

  private buildIdentificationSnapshotFromPatient(patient: any) {
    return {
      nombre: patient?.nombre ?? '',
      rut: patient?.rut ?? '',
      rutExempt: Boolean(patient?.rutExempt),
      rutExemptReason: patient?.rutExemptReason ?? '',
      edad: patient?.edad ?? '',
      edadMeses: patient?.edadMeses ?? null,
      sexo: patient?.sexo ?? '',
      prevision: patient?.prevision ?? '',
      trabajo: patient?.trabajo ?? '',
      domicilio: patient?.domicilio ?? '',
    };
  }

  private buildAnamnesisRemotaSnapshotFromHistory(history: any) {
    const snapshot: Record<string, unknown> = {};

    for (const key of PATIENT_HISTORY_FIELD_KEYS) {
      try {
        const rawValue = parseStoredJson(history?.[key], history?.[key]);
        const sanitized = sanitizePatientHistoryFieldValue(key, rawValue, {
          allowString: true,
        });

        if (sanitized !== undefined && sanitized !== null) {
          snapshot[key] = sanitized;
        }
      } catch {
        // Legacy malformed history should not block opening a new encounter.
      }
    }

    return snapshot;
  }

  private normalizeIdentificationComparisonValue(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : '';
    }

    return JSON.stringify(value);
  }

  private matchesCurrentPatientSnapshot(
    encounter: { patient: any },
    identificationData: Record<string, unknown>,
  ) {
    const patientSnapshot = this.buildIdentificationSnapshotFromPatient(encounter.patient);

    return IDENTIFICATION_SNAPSHOT_FIELD_META.every(({ key }) => (
      this.normalizeIdentificationComparisonValue(identificationData[key]) === this.normalizeIdentificationComparisonValue(patientSnapshot[key])
    ));
  }

  private buildIdentificationSnapshotStatus(encounter: any) {
    const patientSnapshot = this.buildIdentificationSnapshotFromPatient(encounter.patient);
    const identificationSection = (encounter.sections || []).find((section: any) => section.sectionKey === 'IDENTIFICACION');
    const sectionData = parseSectionData(identificationSection?.data);
    const snapshotData =
      typeof sectionData === 'object' && sectionData !== null
        ? sectionData as Record<string, unknown>
        : {};

    const differingEntries = IDENTIFICATION_SNAPSHOT_FIELD_META.filter(({ key }) => (
      this.normalizeIdentificationComparisonValue(snapshotData[key]) !== this.normalizeIdentificationComparisonValue(patientSnapshot[key])
    ));

    return {
      isSnapshot: true,
      snapshotCreatedAt: encounter.createdAt,
      sourcePatientUpdatedAt: encounter.patient?.updatedAt ?? null,
      hasDifferences: differingEntries.length > 0,
      differingFields: differingEntries.map(({ key }) => key),
      differingFieldLabels: differingEntries.map(({ label }) => label),
    };
  }

  async create(patientId: string, createDto: CreateEncounterDto, user: RequestUser) {
    let result:
      | (ReturnType<EncountersService['formatEncounter']> & { reused: boolean })
      | undefined;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        result = await this.prisma.$transaction(
          async (tx) => {
            const effectiveMedicoId = getEffectiveMedicoId(user);
            // Verify patient exists
            const patient = await tx.patient.findUnique({
              where: { id: patientId },
              include: { history: true },
            });

            if (!patient) {
              throw new NotFoundException('Paciente no encontrado');
            }

            if (patient.archivedAt) {
              throw new BadRequestException('No se puede crear una atención para un paciente archivado');
            }

            if (!user.isAdmin && patient.createdById !== effectiveMedicoId) {
              const hasEncounterAccess = await tx.encounter.findFirst({
                where: {
                  patientId,
                  medicoId: effectiveMedicoId,
                },
                select: { id: true },
              });

              if (!hasEncounterAccess) {
                throw new NotFoundException('Paciente no encontrado');
              }
            }

            const inProgress = await tx.encounter.findMany({
              where: {
                patientId,
                medicoId: effectiveMedicoId,
                status: 'EN_PROGRESO',
              },
              orderBy: { createdAt: 'desc' },
              include: {
                sections: { select: { completed: true } },
                patient: true,
                createdBy: { select: { id: true, nombre: true, email: true } },
              },
            });

            if (inProgress.length === 1) {
              return {
                ...this.formatEncounter(inProgress[0]),
                reused: true,
              };
            }

            if (inProgress.length > 1) {
              throw new ConflictException({
                message: 'Hay múltiples atenciones en progreso para este paciente. Selecciona cuál abrir.',
                inProgressEncounters: inProgress.map((enc) => ({
                  id: enc.id,
                  status: enc.status,
                  createdAt: enc.createdAt,
                  updatedAt: enc.updatedAt,
                  createdBy: enc.createdBy,
                  progress: {
                    completed: enc.sections.filter((s) => s.completed).length,
                    total: enc.sections.length,
                  },
                })),
              });
            }

            // Create encounter with initial sections
            const encounter = await tx.encounter.create({
              data: {
                patientId,
                medicoId: effectiveMedicoId,
                createdById: user.id,
                status: 'EN_PROGRESO',
                sections: {
                  create: SECTION_ORDER.map((key) => {
                    const sectionData = key === 'IDENTIFICACION'
                      ? {
                          nombre: patient.nombre,
                          edad: patient.edad,
                          edadMeses: patient.edadMeses ?? undefined,
                          sexo: patient.sexo,
                          trabajo: patient.trabajo || '',
                          prevision: patient.prevision,
                          domicilio: patient.domicilio || '',
                          rut: patient.rut || '',
                          rutExempt: patient.rutExempt,
                          rutExemptReason: patient.rutExemptReason || '',
                        }
                      : key === 'ANAMNESIS_REMOTA' && patient.history
                      ? this.buildAnamnesisRemotaSnapshotFromHistory(patient.history)
                      : {};
                    return {
                      sectionKey: key,
                      data: JSON.stringify(sectionData),
                      schemaVersion: getEncounterSectionSchemaVersion(key),
                      completed: false,
                    };
                  }),
                },
              },
              include: {
                sections: true,
                patient: true,
                createdBy: {
                  select: { id: true, nombre: true, email: true },
                },
              },
            });
            return {
              ...this.formatEncounter(encounter),
              reused: false,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 3) {
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      throw new ConflictException('No se pudo crear la atención. Intente nuevamente.');
    }

    if (!result.reused) {
      await this.auditService.log({
        entityType: 'Encounter',
        entityId: result.id,
        userId: user.id,
        action: 'CREATE',
        diff: { patientId, status: 'EN_PROGRESO' },
      });
    }

    return result;
  }

  async findAll(
    user: RequestUser,
    status: EncounterStatus | undefined,
    search: string | undefined,
    reviewStatus: string | undefined,
    page = 1,
    limit = 15,
  ) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const skip = (page - 1) * limit;

    const where: any = {
      medicoId: effectiveMedicoId,
      patient: {
        archivedAt: null,
      },
    };

    if (status && ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'].includes(status)) {
      where.status = status;
    }

    if (reviewStatus && ['NO_REQUIERE_REVISION', 'LISTA_PARA_REVISION', 'REVISADA_POR_MEDICO'].includes(reviewStatus)) {
      where.reviewStatus = reviewStatus;
    }

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      where.OR = [
        { patient: { nombre: { contains: trimmedSearch } } },
        { patient: { rut: { contains: trimmedSearch } } },
      ];
    }

    const [encounters, total] = await Promise.all([
      this.prisma.encounter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: true,
          createdBy: {
            select: { id: true, nombre: true },
          },
          reviewRequestedBy: {
            select: { id: true, nombre: true },
          },
          reviewedBy: {
            select: { id: true, nombre: true },
          },
          completedBy: {
            select: { id: true, nombre: true },
          },
          sections: {
            select: { completed: true },
          },
        },
      }),
      this.prisma.encounter.count({ where }),
    ]);

    return {
      data: encounters.map((enc) => ({
        ...enc,
        progress: {
          completed: enc.sections.filter((s) => s.completed).length,
          total: enc.sections.length,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }


  async findById(id: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);

    const encounter = await this.prisma.encounter.findFirst({
      where: {
        id,
        medicoId: effectiveMedicoId,
      },
      include: {
        sections: {
          orderBy: { sectionKey: 'asc' },
        },
        patient: {
          include: {
            history: true,
            problems: {
              orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
            },
            tasks: {
              orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
              include: {
                createdBy: { select: { id: true, nombre: true } },
              },
            },
          },
        },
        createdBy: {
          select: { id: true, nombre: true, email: true },
        },
        reviewRequestedBy: {
          select: { id: true, nombre: true },
        },
        reviewedBy: {
          select: { id: true, nombre: true },
        },
        completedBy: {
          select: { id: true, nombre: true },
        },
        suggestions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        attachments: true,
        tasks: {
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
          include: {
            createdBy: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    return this.formatEncounter(encounter);
  }

  async findByPatient(patientId: string, user: RequestUser) {
    const effectiveMedicoId = getEffectiveMedicoId(user);
    const encounters = await this.prisma.encounter.findMany({
      where: {
        patientId,
        medicoId: effectiveMedicoId,
        patient: {
          archivedAt: null,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, nombre: true },
        },
        reviewRequestedBy: {
          select: { id: true, nombre: true },
        },
        reviewedBy: {
          select: { id: true, nombre: true },
        },
        completedBy: {
          select: { id: true, nombre: true },
        },
        sections: {
          select: { sectionKey: true, completed: true },
        },
      },
    });

    return encounters.map((enc) => ({
      ...enc,
      progress: {
        completed: enc.sections.filter((s) => s.completed).length,
        total: enc.sections.length,
      },
    }));
  }

  async updateSection(
    encounterId: string,
    sectionKey: SectionKey,
    dto: UpdateSectionDto,
    user: RequestUser,
  ) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: { sections: true, patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    const effectiveMedicoId = getEffectiveMedicoId(user);

    if (encounter.medicoId !== effectiveMedicoId) {
      throw new ForbiddenException('No tiene permisos para editar esta atención');
    }

    if (encounter.status === 'COMPLETADO') {
      throw new BadRequestException('No se puede editar una atención completada');
    }

    if (encounter.status === 'CANCELADO') {
      throw new BadRequestException('No se puede editar una atención cancelada');
    }

    // Only creator or MEDICO can edit
    if (encounter.createdById !== user.id && user.role !== 'MEDICO') {
      throw new ForbiddenException('No tiene permisos para editar esta atención');
    }

    const section = encounter.sections.find((s) => s.sectionKey === sectionKey);
    if (!section) {
      throw new NotFoundException('Sección no encontrada');
    }

    const sanitizedData = this.sanitizeSectionData(sectionKey, dto.data);

    if (sectionKey === 'IDENTIFICACION' && !this.matchesCurrentPatientSnapshot(encounter, sanitizedData)) {
      throw new BadRequestException(
        'La identificación de la atención es un snapshot de solo lectura. Edite la ficha del paciente o restaure desde la ficha maestra.',
      );
    }

    const updatedSection = await this.prisma.encounterSection.update({
      where: { id: section.id },
      data: {
        data: JSON.stringify(sanitizedData),
        schemaVersion: getEncounterSectionSchemaVersion(sectionKey),
        completed: dto.completed ?? section.completed,
      },
    });

    await this.auditService.log({
      entityType: 'EncounterSection',
      entityId: section.id,
      userId: user.id,
      action: 'UPDATE',
      diff: this.summarizeSectionAuditData(sectionKey, sanitizedData, dto.completed),
    });

    return updatedSection;
  }

  async complete(id: string, userId: string, closureNote?: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: { sections: true, patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para completar esta atención');
    }

    const sectionByKey = new Map(encounter.sections.map((section) => [section.sectionKey as SectionKey, section]));

    const incompleteSections = REQUIRED_COMPLETION_SECTIONS.filter((key) => {
      const section = sectionByKey.get(key);
      return !section || !section.completed;
    });

    if (incompleteSections.length > 0) {
      throw new BadRequestException(
        `Las siguientes secciones obligatorias no están completas: ${incompleteSections
          .map((key) => SECTION_LABELS[key])
          .join(', ')}`,
      );
    }

    const semanticallyIncompleteSections = REQUIRED_SEMANTIC_SECTIONS.filter((key) => {
      const section = sectionByKey.get(key);
      if (!section) {
        return true;
      }

      return !hasMeaningfulContent(parseSectionData(section.data));
    });

    if (semanticallyIncompleteSections.length > 0) {
      throw new BadRequestException(
        `Las siguientes secciones obligatorias no tienen contenido clínico suficiente: ${semanticallyIncompleteSections
          .map((key) => SECTION_LABELS[key])
          .join(', ')}`,
      );
    }

    const sanitizedClosureNote = closureNote
      ? (this.sanitizeText(closureNote, 1000) ?? null)
      : null;

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'COMPLETADO',
        reviewStatus: 'REVISADA_POR_MEDICO',
        reviewedAt: new Date(),
        reviewedById: userId,
        reviewNote: sanitizedClosureNote,
        completedAt: new Date(),
        completedById: userId,
        closureNote: sanitizedClosureNote,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewRequestedBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
        completedBy: { select: { id: true, nombre: true } },
      },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: {
        status: 'COMPLETADO',
        closureNote: this.summarizeWorkflowNoteAudit(sanitizedClosureNote),
      },
    });

    return this.formatEncounter(updated);
  }

  async reopen(id: string, userId: string, note: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.status !== 'COMPLETADO') {
      throw new BadRequestException('Solo se pueden reabrir atenciones completadas');
    }

    if (encounter.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para reabrir esta atención');
    }

    const sanitizedNote = this.sanitizeRequiredWorkflowNote(
      note,
      'La nota de reapertura',
      REVIEW_NOTE_MIN_LENGTH,
      1000,
    );

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        status: 'EN_PROGRESO',
        reviewStatus: 'NO_REQUIERE_REVISION',
        reviewRequestedAt: null,
        reviewRequestedById: null,
        reviewedAt: null,
        reviewedById: null,
        reviewNote: null,
        completedAt: null,
        completedById: null,
        closureNote: null,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewRequestedBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
        completedBy: { select: { id: true, nombre: true } },
      },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: {
        status: 'EN_PROGRESO',
        reopenedBy: userId,
        note: this.summarizeWorkflowNoteAudit(sanitizedNote),
      },
    });

    return this.formatEncounter(updated);
  }

  async cancel(id: string, userId: string) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.medicoId !== userId) {
      throw new ForbiddenException('No tiene permisos para cancelar esta atención');
    }

    if (encounter.status !== 'EN_PROGRESO') {
      throw new BadRequestException('Solo se pueden cancelar atenciones en progreso');
    }

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId,
      action: 'UPDATE',
      diff: { status: 'CANCELADO' },
    });

    return updated;
  }

  async updateReviewStatus(
    id: string,
    user: RequestUser,
    reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO',
    note?: string,
  ) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id },
      include: {
        patient: true,
      },
    });

    if (!encounter) {
      throw new NotFoundException('Atención no encontrada');
    }

    if (encounter.medicoId !== getEffectiveMedicoId(user)) {
      throw new ForbiddenException('No tiene permisos para actualizar la revisión de esta atención');
    }

    if (encounter.status === 'CANCELADO') {
      throw new BadRequestException('No se puede revisar una atención cancelada');
    }

    if (reviewStatus === 'REVISADA_POR_MEDICO' && user.role !== 'MEDICO') {
      throw new ForbiddenException('Solo un médico puede marcar la atención como revisada');
    }

    if (reviewStatus === 'LISTA_PARA_REVISION' && user.role !== 'ASISTENTE') {
      throw new BadRequestException('Solo un asistente puede enviar una atención a revisión médica');
    }

    if (reviewStatus === 'NO_REQUIERE_REVISION' && user.role !== 'MEDICO') {
      throw new ForbiddenException('Solo un médico puede despejar una revisión pendiente');
    }

    const requiresNote = reviewStatus === 'LISTA_PARA_REVISION' || reviewStatus === 'REVISADA_POR_MEDICO';
    const sanitizedNote = requiresNote
      ? this.sanitizeRequiredWorkflowNote(note, 'La nota de revisión', REVIEW_NOTE_MIN_LENGTH, 500)
      : this.sanitizeText(note, 500) ?? null;

    const updated = await this.prisma.encounter.update({
      where: { id },
      data: {
        reviewStatus,
        reviewRequestedAt: reviewStatus === 'LISTA_PARA_REVISION' ? new Date() : null,
        reviewRequestedById: reviewStatus === 'LISTA_PARA_REVISION' ? user.id : null,
        reviewedAt: reviewStatus === 'REVISADA_POR_MEDICO' ? new Date() : null,
        reviewedById: reviewStatus === 'REVISADA_POR_MEDICO' ? user.id : null,
        reviewNote: sanitizedNote,
      },
      include: {
        sections: true,
        patient: true,
        createdBy: { select: { id: true, nombre: true } },
        reviewRequestedBy: { select: { id: true, nombre: true } },
        reviewedBy: { select: { id: true, nombre: true } },
        completedBy: { select: { id: true, nombre: true } },
        tasks: {
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
          include: { createdBy: { select: { id: true, nombre: true } } },
        },
      },
    });

    await this.auditService.log({
      entityType: 'Encounter',
      entityId: id,
      userId: user.id,
      action: 'UPDATE',
      diff: {
        reviewStatus,
        note: this.summarizeWorkflowNoteAudit(sanitizedNote),
      },
    });

    return this.formatEncounter(updated);
  }

  async getDashboard(user: RequestUser) {
    const medicoId = getEffectiveMedicoId(user);

    const where = medicoId
      ? {
          medicoId,
          patient: {
            archivedAt: null,
          },
        }
      : {};

    const [enProgreso, completado, cancelado, pendingReview, recent, upcomingTasks] = await Promise.all([
      this.prisma.encounter.count({ where: { ...where, status: 'EN_PROGRESO' } }),
      this.prisma.encounter.count({ where: { ...where, status: 'COMPLETADO' } }),
      this.prisma.encounter.count({ where: { ...where, status: 'CANCELADO' } }),
      this.prisma.encounter.count({ where: { ...where, reviewStatus: 'LISTA_PARA_REVISION' } }),
      this.prisma.encounter.findMany({
        where,
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
          patient: { select: { id: true, nombre: true, rut: true } },
          createdBy: { select: { id: true, nombre: true } },
          sections: { select: { sectionKey: true, completed: true } },
        },
      }),
      this.prisma.encounterTask.findMany({
        where: {
          patient: {
            archivedAt: null,
          },
          encounter: medicoId ? { medicoId } : undefined,
          status: {
            in: ['PENDIENTE', 'EN_PROCESO'],
          },
        },
        take: 6,
        orderBy: [
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          patient: {
            select: { id: true, nombre: true, rut: true },
          },
          createdBy: {
            select: { id: true, nombre: true },
          },
        },
      }),
    ]);

    return {
      counts: {
        enProgreso,
        completado,
        cancelado,
        pendingReview,
        upcomingTasks: upcomingTasks.length,
        total: enProgreso + completado + cancelado,
      },
      recent: recent.map((enc) => ({
        id: enc.id,
        patientId: enc.patientId,
        patientName: enc.patient.nombre,
        patientRut: enc.patient.rut,
        createdByName: enc.createdBy.nombre,
        status: enc.status,
        createdAt: enc.createdAt,
        updatedAt: enc.updatedAt,
        progress: {
          completed: enc.sections.filter((s) => s.completed).length,
          total: enc.sections.length,
        },
      })),
      upcomingTasks: upcomingTasks.map((task) => ({
        id: task.id,
        title: task.title,
        type: task.type,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        isOverdue: Boolean(task.dueDate && isDateOnlyBeforeToday(task.dueDate)),
        patient: task.patient,
        createdBy: task.createdBy,
      })),
    };
  }

  private formatEncounter(encounter: any) {
    // Sort sections in order
    const sortedSections = [...(encounter.sections || [])].sort((a: any, b: any) => {
      return SECTION_ORDER.indexOf(a.sectionKey) - SECTION_ORDER.indexOf(b.sectionKey);
    });

    return {
      ...encounter,
      identificationSnapshotStatus: this.buildIdentificationSnapshotStatus(encounter),
      patient: encounter.patient
        ? {
            ...encounter.patient,
            history: encounter.patient.history,
            problems: (encounter.patient.problems || []).map((problem: any) => ({ ...problem })),
            tasks: (encounter.patient.tasks || []).map((task: any) => this.formatTask(task)),
          }
        : encounter.patient,
      tasks: (encounter.tasks || []).map((task: any) => this.formatTask(task)),
      sections: sortedSections.map((section: any) => ({
        ...formatEncounterSectionForRead({
          ...section,
          data: parseSectionData(section.data) ?? {},
        }),
        label: SECTION_LABELS[section.sectionKey as SectionKey],
        order: SECTION_ORDER.indexOf(section.sectionKey as SectionKey),
      })),
    };
  }
}

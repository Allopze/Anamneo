/**
 * Pure-function section sanitizers for encounter data.
 * Extracted from EncountersService to keep the service focused on CRUD / workflow.
 */
import { BadRequestException } from '@nestjs/common';
import { PREVISIONES, SEXOS, SectionKey } from '../common/types';
import { parseStoredJson } from '../common/utils/encounter-sections';
import { getEncounterSectionSchemaVersion } from '../common/utils/encounter-section-meta';
import { sanitizeClinicalText } from '../common/utils/sanitize-html';
import {
  PATIENT_HISTORY_FIELD_KEYS,
  sanitizePatientHistoryFieldValue,
  sanitizePatientHistoryPayload,
} from '../common/utils/patient-history';
import { encryptField, isEncryptionEnabled } from '../common/utils/field-crypto';

// ─── Constants ───────────────────────────────────────────────────────────────

export const REQUIRED_COMPLETION_SECTIONS: SectionKey[] = [
  'IDENTIFICACION',
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

export const REQUIRED_SEMANTIC_SECTIONS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

export const VITAL_SIGNS_ALERT_GENERATION_WARNING =
  'La sección se guardó, pero no se pudo completar la verificación automática de alertas por signos vitales.';

const ORDER_STATUSES = ['PENDIENTE', 'RECIBIDO', 'REVISADO'] as const;
const MEDICATION_ROUTES = [
  'ORAL',
  'IV',
  'IM',
  'SC',
  'TOPICA',
  'INHALATORIA',
  'RECTAL',
  'SUBLINGUAL',
  'OFTALMICA',
  'OTRA',
] as const;
const CHOSEN_MODES = ['AUTO', 'MANUAL'] as const;
const REVIEW_NOTE_MIN_LENGTH = 10;
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

// ─── Serialization ───────────────────────────────────────────────────────────

export function serializeSectionData(data: unknown): string {
  const json = JSON.stringify(data);
  return isEncryptionEnabled() ? encryptField(json) : json;
}

export function parseSectionData(rawData: unknown): unknown {
  return parseStoredJson(rawData, null);
}

export function hasMeaningfulContent(value: unknown): boolean {
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

// ─── Primitive sanitizers ────────────────────────────────────────────────────

export function sanitizeText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('La sección contiene campos de texto inválidos');
  }

  const sanitized = sanitizeClinicalText(value, maxLength);
  return sanitized || undefined;
}

export function sanitizeTextListField(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const sanitized = sanitizeText(value, maxLength);
  return sanitized === undefined ? undefined : sanitized;
}

export function sanitizeNumericStringField(value: unknown, label: string, min: number, max: number) {
  const sanitized = sanitizeTextListField(value, 32);
  if (sanitized === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(sanitized.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`${label} debe estar entre ${min} y ${max}`);
  }

  return String(parsed);
}

export function sanitizePressureField(value: unknown) {
  const sanitized = sanitizeTextListField(value, 16);
  if (sanitized === undefined) {
    return undefined;
  }

  if (!/^\d{2,3}\/\d{2,3}$/.test(sanitized)) {
    throw new BadRequestException('La presión arterial debe tener formato 120/80');
  }

  return sanitized;
}

export function sanitizeRequiredWorkflowNote(value: unknown, label: string, minLength: number, maxLength: number) {
  const sanitized = sanitizeText(value, maxLength);
  if (!sanitized || sanitized.length < minLength) {
    throw new BadRequestException(`${label} debe tener al menos ${minLength} caracteres`);
  }

  return sanitized;
}

export { REVIEW_NOTE_MIN_LENGTH };

// ─── Structured item sanitizers ──────────────────────────────────────────────

export function sanitizeStructuredMedication(item: unknown, index: number) {
  if (typeof item !== 'object' || item === null) {
    throw new BadRequestException(`Medicamento estructurado #${index + 1} inválido`);
  }

  const record = item as Record<string, unknown>;
  const id = sanitizeText(record.id, 100);
  if (!id) {
    throw new BadRequestException(`Medicamento estructurado #${index + 1} requiere id`);
  }

  const nombre = sanitizeTextListField(record.nombre, 200);
  const dosis = sanitizeTextListField(record.dosis, 120);
  const via = (() => {
    if (record.via === undefined || record.via === null || record.via === '') {
      return undefined;
    }

    if (
      typeof record.via !== 'string' ||
      !MEDICATION_ROUTES.includes(record.via as (typeof MEDICATION_ROUTES)[number])
    ) {
      throw new BadRequestException(`La vía del medicamento estructurado #${index + 1} no es válida`);
    }

    return record.via;
  })();
  const frecuencia = sanitizeTextListField(record.frecuencia, 120);
  const duracion = sanitizeTextListField(record.duracion, 120);
  const indicacion = sanitizeTextListField(record.indicacion, 400);

  if (!nombre && !dosis && !via && !frecuencia && !duracion && !indicacion) {
    return null;
  }

  return {
    id,
    ...(nombre !== undefined ? { nombre } : {}),
    ...(dosis !== undefined ? { dosis } : {}),
    ...(via !== undefined ? { via } : {}),
    ...(frecuencia !== undefined ? { frecuencia } : {}),
    ...(duracion !== undefined ? { duracion } : {}),
    ...(indicacion !== undefined ? { indicacion } : {}),
  };
}

export function sanitizeStructuredOrder(item: unknown, index: number, label: 'examen' | 'derivación') {
  if (typeof item !== 'object' || item === null) {
    throw new BadRequestException(`${label} estructurado #${index + 1} inválido`);
  }

  const record = item as Record<string, unknown>;
  const id = sanitizeText(record.id, 100);
  if (!id) {
    throw new BadRequestException(`${label} estructurado #${index + 1} requiere id`);
  }

  const nombre = sanitizeTextListField(record.nombre, 200);
  const indicacion = sanitizeTextListField(record.indicacion, 400);
  const resultado = sanitizeTextListField(record.resultado, 1000);
  const estado = (() => {
    if (record.estado === undefined || record.estado === null || record.estado === '') {
      return 'PENDIENTE';
    }

    if (
      typeof record.estado !== 'string' ||
      !ORDER_STATUSES.includes(record.estado as (typeof ORDER_STATUSES)[number])
    ) {
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

// ─── Section-level sanitizers ────────────────────────────────────────────────

export function sanitizeExamenFisicoData(data: Record<string, unknown>) {
  const signosVitalesRaw = data.signosVitales;
  let signosVitales: Record<string, string> | undefined;

  if (signosVitalesRaw !== undefined && signosVitalesRaw !== null) {
    if (typeof signosVitalesRaw !== 'object' || Array.isArray(signosVitalesRaw)) {
      throw new BadRequestException('Los signos vitales deben enviarse como objeto');
    }

    const raw = signosVitalesRaw as Record<string, unknown>;
    const peso = sanitizeNumericStringField(raw.peso, 'El peso', 0.5, 500);
    const talla = sanitizeNumericStringField(raw.talla, 'La talla', 20, 250);
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
      ...(sanitizePressureField(raw.presionArterial) !== undefined
        ? { presionArterial: sanitizePressureField(raw.presionArterial)! }
        : {}),
      ...(sanitizeNumericStringField(raw.frecuenciaCardiaca, 'La frecuencia cardiaca', 20, 250) !== undefined
        ? {
            frecuenciaCardiaca: sanitizeNumericStringField(
              raw.frecuenciaCardiaca,
              'La frecuencia cardiaca',
              20,
              250,
            )!,
          }
        : {}),
      ...(sanitizeNumericStringField(raw.frecuenciaRespiratoria, 'La frecuencia respiratoria', 5, 60) !==
      undefined
        ? {
            frecuenciaRespiratoria: sanitizeNumericStringField(
              raw.frecuenciaRespiratoria,
              'La frecuencia respiratoria',
              5,
              60,
            )!,
          }
        : {}),
      ...(sanitizeNumericStringField(raw.temperatura, 'La temperatura', 35, 42) !== undefined
        ? { temperatura: sanitizeNumericStringField(raw.temperatura, 'La temperatura', 35, 42)! }
        : {}),
      ...(sanitizeNumericStringField(raw.saturacionOxigeno, 'La saturación de oxígeno', 0, 100) !== undefined
        ? {
            saturacionOxigeno: sanitizeNumericStringField(
              raw.saturacionOxigeno,
              'La saturación de oxígeno',
              0,
              100,
            )!,
          }
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
    ...(sanitizeTextListField(data.estadoGeneral, 60) !== undefined
      ? { estadoGeneral: sanitizeTextListField(data.estadoGeneral, 60) }
      : {}),
    ...(sanitizeTextListField(data.estadoGeneralNotas, 500) !== undefined
      ? { estadoGeneralNotas: sanitizeTextListField(data.estadoGeneralNotas, 500) }
      : {}),
    ...(signosVitales ? { signosVitales } : {}),
    ...(sanitizeTextListField(data.cabeza, 2000) !== undefined
      ? { cabeza: sanitizeTextListField(data.cabeza, 2000) }
      : {}),
    ...(sanitizeTextListField(data.cuello, 2000) !== undefined
      ? { cuello: sanitizeTextListField(data.cuello, 2000) }
      : {}),
    ...(sanitizeTextListField(data.torax, 2000) !== undefined
      ? { torax: sanitizeTextListField(data.torax, 2000) }
      : {}),
    ...(sanitizeTextListField(data.abdomen, 2000) !== undefined
      ? { abdomen: sanitizeTextListField(data.abdomen, 2000) }
      : {}),
    ...(sanitizeTextListField(data.extremidades, 2000) !== undefined
      ? { extremidades: sanitizeTextListField(data.extremidades, 2000) }
      : {}),
  };
}

export function sanitizeTratamientoData(data: Record<string, unknown>) {
  const medicamentos = (() => {
    if (data.medicamentosEstructurados === undefined || data.medicamentosEstructurados === null) {
      return undefined;
    }

    if (!Array.isArray(data.medicamentosEstructurados)) {
      throw new BadRequestException('Los medicamentos estructurados deben enviarse como arreglo');
    }

    return data.medicamentosEstructurados
      .slice(0, 100)
      .map((item, index) => sanitizeStructuredMedication(item, index))
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
      .map((item, index) => sanitizeStructuredOrder(item, index, 'examen'))
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
      .map((item, index) => sanitizeStructuredOrder(item, index, 'derivación'))
      .filter((item): item is NonNullable<typeof item> => item !== null);
  })();

  return {
    ...(sanitizeTextListField(data.plan, 4000) !== undefined
      ? { plan: sanitizeTextListField(data.plan, 4000) }
      : {}),
    ...(sanitizeTextListField(data.indicaciones, 4000) !== undefined
      ? { indicaciones: sanitizeTextListField(data.indicaciones, 4000) }
      : {}),
    ...(sanitizeTextListField(data.receta, 4000) !== undefined
      ? { receta: sanitizeTextListField(data.receta, 4000) }
      : {}),
    ...(sanitizeTextListField(data.examenes, 3000) !== undefined
      ? { examenes: sanitizeTextListField(data.examenes, 3000) }
      : {}),
    ...(sanitizeTextListField(data.derivaciones, 3000) !== undefined
      ? { derivaciones: sanitizeTextListField(data.derivaciones, 3000) }
      : {}),
    ...(medicamentos !== undefined ? { medicamentosEstructurados: medicamentos } : {}),
    ...(examenes !== undefined ? { examenesEstructurados: examenes } : {}),
    ...(derivaciones !== undefined ? { derivacionesEstructuradas: derivaciones } : {}),
  };
}

export function sanitizeRespuestaTratamientoData(data: Record<string, unknown>) {
  return {
    ...(sanitizeTextListField(data.evolucion, 4000) !== undefined
      ? { evolucion: sanitizeTextListField(data.evolucion, 4000) }
      : {}),
    ...(sanitizeTextListField(data.resultadosExamenes, 4000) !== undefined
      ? { resultadosExamenes: sanitizeTextListField(data.resultadosExamenes, 4000) }
      : {}),
    ...(sanitizeTextListField(data.ajustesTratamiento, 4000) !== undefined
      ? { ajustesTratamiento: sanitizeTextListField(data.ajustesTratamiento, 4000) }
      : {}),
    ...(sanitizeTextListField(data.planSeguimiento, 4000) !== undefined
      ? { planSeguimiento: sanitizeTextListField(data.planSeguimiento, 4000) }
      : {}),
  };
}

export function sanitizeMotivoConsultaData(data: Record<string, unknown>) {
  const afeccionSeleccionada = (() => {
    const raw = data.afeccionSeleccionada;
    if (raw === undefined || raw === null) {
      return undefined;
    }

    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('La afección seleccionada no es válida');
    }

    const record = raw as Record<string, unknown>;
    const id = sanitizeText(record.id, 100);
    const name = sanitizeText(record.name, 200);
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

    if (
      typeof data.modoSeleccion !== 'string' ||
      !CHOSEN_MODES.includes(data.modoSeleccion as (typeof CHOSEN_MODES)[number])
    ) {
      throw new BadRequestException('El modo de selección del motivo de consulta no es válido');
    }

    return data.modoSeleccion;
  })();

  return {
    ...(sanitizeTextListField(data.texto, 4000) !== undefined
      ? { texto: sanitizeTextListField(data.texto, 4000) }
      : {}),
    ...(afeccionSeleccionada !== undefined ? { afeccionSeleccionada } : {}),
    ...(modoSeleccion !== undefined ? { modoSeleccion } : {}),
  };
}

export function sanitizeAnamnesisProximaData(data: Record<string, unknown>) {
  return {
    ...(sanitizeTextListField(data.relatoAmpliado, 5000) !== undefined
      ? { relatoAmpliado: sanitizeTextListField(data.relatoAmpliado, 5000) }
      : {}),
    ...(sanitizeTextListField(data.inicio, 300) !== undefined
      ? { inicio: sanitizeTextListField(data.inicio, 300) }
      : {}),
    ...(sanitizeTextListField(data.evolucion, 300) !== undefined
      ? { evolucion: sanitizeTextListField(data.evolucion, 300) }
      : {}),
    ...(sanitizeTextListField(data.factoresAgravantes, 2000) !== undefined
      ? { factoresAgravantes: sanitizeTextListField(data.factoresAgravantes, 2000) }
      : {}),
    ...(sanitizeTextListField(data.factoresAtenuantes, 2000) !== undefined
      ? { factoresAtenuantes: sanitizeTextListField(data.factoresAtenuantes, 2000) }
      : {}),
    ...(sanitizeTextListField(data.sintomasAsociados, 3000) !== undefined
      ? { sintomasAsociados: sanitizeTextListField(data.sintomasAsociados, 3000) }
      : {}),
  };
}

export function sanitizeAnamnesisRemotaData(data: Record<string, unknown>) {
  return sanitizePatientHistoryPayload(data, {
    allowString: true,
    allowReadonly: true,
    rejectUnknownKeys: true,
  });
}

export function sanitizeRevisionSistemasData(data: Record<string, unknown>) {
  if (data.negativa !== undefined && typeof data.negativa !== 'boolean') {
    throw new BadRequestException('El indicador negativa de revisión por sistemas no es válido');
  }

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

    const notas = sanitizeTextListField(record.notas, 1200);
    const checked = record.checked === true;

    if (!checked && notas === undefined) {
      continue;
    }

    sanitized[key] = {
      checked,
      notas: notas ?? '',
    };
  }

  if (data.negativa === true) {
    if (Object.keys(sanitized).length > 0) {
      throw new BadRequestException('No se puede marcar revisión por sistemas negativa si existen hallazgos');
    }

    return { negativa: true };
  }

  return sanitized;
}

export function sanitizeSospechaDiagnosticaData(data: Record<string, unknown>) {
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
      const id = sanitizeText(record.id, 100);
      if (!id) {
        throw new BadRequestException(`Sospecha diagnóstica #${index + 1} requiere id`);
      }

      const diagnostico = sanitizeTextListField(record.diagnostico, 300);
      const codigoCie10 = sanitizeTextListField(record.codigoCie10, 32);
      const descripcionCie10 = sanitizeTextListField(record.descripcionCie10, 300);
      const notas = sanitizeTextListField(record.notas, 1200);

      if (!diagnostico && !codigoCie10 && !descripcionCie10 && !notas) {
        return null;
      }

      return {
        id,
        diagnostico: diagnostico ?? descripcionCie10 ?? '',
        ...(codigoCie10 !== undefined ? { codigoCie10 } : {}),
        ...(descripcionCie10 !== undefined ? { descripcionCie10 } : {}),
        prioridad: index + 1,
        notas: notas ?? '',
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    sospechas,
  };
}

export function sanitizeObservacionesData(data: Record<string, unknown>) {
  return {
    ...(sanitizeTextListField(data.observaciones, 5000) !== undefined
      ? { observaciones: sanitizeTextListField(data.observaciones, 5000) }
      : {}),
    ...(sanitizeTextListField(data.notasInternas, 3000) !== undefined
      ? { notasInternas: sanitizeTextListField(data.notasInternas, 3000) }
      : {}),
    ...(sanitizeTextListField(data.resumenClinico, 5000) !== undefined
      ? { resumenClinico: sanitizeTextListField(data.resumenClinico, 5000) }
      : {}),
  };
}

export function sanitizeIdentificacionData(data: Record<string, unknown>) {
  const normalizedEdad = (() => {
    const edad = data.edad;

    if (edad === undefined || edad === null || edad === '') {
      return undefined;
    }

    const parsed =
      typeof edad === 'number' ? edad : typeof edad === 'string' ? Number.parseInt(edad, 10) : Number.NaN;

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 130) {
      throw new BadRequestException('La edad en identificación debe ser un número entero entre 0 y 130');
    }

    return parsed;
  })();

  const normalizedEdadMeses = (() => {
    const edadMeses = data.edadMeses;

    if (edadMeses === undefined || edadMeses === null || edadMeses === '') {
      return undefined;
    }

    const parsed =
      typeof edadMeses === 'number'
        ? edadMeses
        : typeof edadMeses === 'string'
          ? Number.parseInt(edadMeses, 10)
          : Number.NaN;

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 11) {
      throw new BadRequestException('La edad en meses debe ser un número entero entre 0 y 11');
    }

    return parsed;
  })();

  const normalizedSexo = (() => {
    if (data.sexo === undefined || data.sexo === null || data.sexo === '') {
      return undefined;
    }

    if (typeof data.sexo !== 'string' || !SEXOS.includes(data.sexo as (typeof SEXOS)[number])) {
      throw new BadRequestException('El sexo en identificación no es válido');
    }

    return data.sexo;
  })();

  const normalizedPrevision = (() => {
    if (data.prevision === undefined || data.prevision === null || data.prevision === '') {
      return undefined;
    }

    if (typeof data.prevision !== 'string' || !PREVISIONES.includes(data.prevision as (typeof PREVISIONES)[number])) {
      throw new BadRequestException('La previsión en identificación no es válida');
    }

    return data.prevision;
  })();

  if (data.rutExempt !== undefined && data.rutExempt !== null && typeof data.rutExempt !== 'boolean') {
    throw new BadRequestException('El indicador de exención de RUT no es válido');
  }

  const rut = sanitizeText(data.rut, 32);
  const rutExemptReason = sanitizeText(data.rutExemptReason, 200);
  const nombre = sanitizeText(data.nombre, 200);
  const trabajo = sanitizeText(data.trabajo, 200);
  const domicilio = sanitizeText(data.domicilio, 300);

  return {
    ...(rut !== undefined ? { rut } : {}),
    ...(typeof data.rutExempt === 'boolean' ? { rutExempt: data.rutExempt } : {}),
    ...(rutExemptReason !== undefined ? { rutExemptReason } : {}),
    ...(nombre !== undefined ? { nombre } : {}),
    ...(normalizedEdad !== undefined ? { edad: normalizedEdad } : {}),
    ...(normalizedEdadMeses !== undefined ? { edadMeses: normalizedEdadMeses } : {}),
    ...(normalizedSexo !== undefined ? { sexo: normalizedSexo } : {}),
    ...(trabajo !== undefined ? { trabajo } : {}),
    ...(normalizedPrevision !== undefined ? { prevision: normalizedPrevision } : {}),
    ...(domicilio !== undefined ? { domicilio } : {}),
  };
}

/**
 * Dispatch to the appropriate section-level sanitizer.
 */
export function sanitizeSectionPayload(sectionKey: SectionKey, data: Record<string, unknown>) {
  if (sectionKey === 'IDENTIFICACION') {
    return sanitizeIdentificacionData(data);
  }

  if (sectionKey === 'MOTIVO_CONSULTA') {
    return sanitizeMotivoConsultaData(data);
  }

  if (sectionKey === 'ANAMNESIS_PROXIMA') {
    return sanitizeAnamnesisProximaData(data);
  }

  if (sectionKey === 'ANAMNESIS_REMOTA') {
    return sanitizeAnamnesisRemotaData(data);
  }

  if (sectionKey === 'REVISION_SISTEMAS') {
    return sanitizeRevisionSistemasData(data);
  }

  if (sectionKey === 'EXAMEN_FISICO') {
    return sanitizeExamenFisicoData(data);
  }

  if (sectionKey === 'SOSPECHA_DIAGNOSTICA') {
    return sanitizeSospechaDiagnosticaData(data);
  }

  if (sectionKey === 'TRATAMIENTO') {
    return sanitizeTratamientoData(data);
  }

  if (sectionKey === 'RESPUESTA_TRATAMIENTO') {
    return sanitizeRespuestaTratamientoData(data);
  }

  if (sectionKey === 'OBSERVACIONES') {
    return sanitizeObservacionesData(data);
  }

  return data;
}

// ─── Audit helpers ───────────────────────────────────────────────────────────

export function summarizeSectionAuditData(sectionKey: SectionKey, data: unknown, completed?: boolean) {
  const topLevelKeys =
    typeof data === 'object' && data !== null && !Array.isArray(data)
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

export function summarizeWorkflowNoteAudit(note: string | null | undefined) {
  if (!note) {
    return null;
  }

  return {
    redacted: true,
    provided: true,
    length: note.length,
  };
}

// ─── Snapshot helpers ────────────────────────────────────────────────────────

export const IDENTIFICATION_SNAPSHOT_FIELD_META = [
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

export function buildIdentificationSnapshotFromPatient(patient: any) {
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

export function buildAnamnesisRemotaSnapshotFromHistory(history: any) {
  const snapshot: Record<string, unknown> = {
    readonly: true,
  };

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

export function normalizeIdentificationComparisonValue(value: unknown) {
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

  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

export function matchesCurrentPatientSnapshot(encounter: { patient: any }, identificationData: Record<string, unknown>) {
  const patientSnapshot = buildIdentificationSnapshotFromPatient(encounter.patient);

  return IDENTIFICATION_SNAPSHOT_FIELD_META.every(
    ({ key }) =>
      normalizeIdentificationComparisonValue(identificationData[key]) ===
      normalizeIdentificationComparisonValue(patientSnapshot[key]),
  );
}

export function buildIdentificationSnapshotStatus(encounter: any) {
  const patientSnapshot = buildIdentificationSnapshotFromPatient(encounter.patient);
  const identificationSection = (encounter.sections || []).find(
    (section: any) => section.sectionKey === 'IDENTIFICACION',
  );
  const sectionData = parseSectionData(identificationSection?.data);
  const snapshotData =
    typeof sectionData === 'object' && sectionData !== null ? (sectionData as Record<string, unknown>) : {};

  const differingEntries = IDENTIFICATION_SNAPSHOT_FIELD_META.filter(
    ({ key }) =>
      normalizeIdentificationComparisonValue(snapshotData[key]) !==
      normalizeIdentificationComparisonValue(patientSnapshot[key]),
  );

  return {
    isSnapshot: true,
    snapshotCreatedAt: encounter.createdAt,
    sourcePatientUpdatedAt: encounter.patient?.updatedAt ?? null,
    hasDifferences: differingEntries.length > 0,
    differingFields: differingEntries.map(({ key }) => key),
    differingFieldLabels: differingEntries.map(({ label }) => label),
  };
}

// ─── Response formatters ─────────────────────────────────────────────────────

export function formatTask(task: any) {
  return {
    id: task.id,
    patientId: task.patientId,
    encounterId: task.encounterId ?? null,
    title: task.title,
    details: task.details ?? null,
    type: task.type,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ?? null,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    isOverdue: task.isOverdue ?? undefined,
    createdBy: task.createdBy ? { id: task.createdBy.id, nombre: task.createdBy.nombre } : undefined,
  };
}

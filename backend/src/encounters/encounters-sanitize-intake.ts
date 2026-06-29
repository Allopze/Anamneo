import { BadRequestException } from '@nestjs/common';
import { sanitizePatientHistoryPayload } from '../common/utils/patient-history';
import {
  sanitizeText,
  sanitizeTextListField,
} from './encounters-sanitize-primitives';

const CHOSEN_MODES = ['AUTO', 'MANUAL'] as const;
const ASOCIACION_COMIDA = ['SI', 'NO', 'NO_CLARO'] as const;

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
  const perfilDolorAbdominal = (() => {
    const raw = data.perfilDolorAbdominal;
    if (raw === undefined || raw === null) {
      return undefined;
    }

    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('El perfil estructurado de dolor abdominal no es válido');
    }

    const record = raw as Record<string, unknown>;
    const parseOptionalBoolean = (value: unknown, field: string) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      if (typeof value !== 'boolean') {
        throw new BadRequestException(`El campo ${field} del perfil de dolor abdominal no es válido`);
      }

      return value;
    };

    const asociadoComida = (() => {
      if (record.asociadoComida === undefined || record.asociadoComida === null || record.asociadoComida === '') {
        return undefined;
      }

      if (
        typeof record.asociadoComida !== 'string' ||
        !ASOCIACION_COMIDA.includes(record.asociadoComida as (typeof ASOCIACION_COMIDA)[number])
      ) {
        throw new BadRequestException('La asociación con comida del perfil de dolor abdominal no es válida');
      }

      return record.asociadoComida;
    })();

    const sanitized = {
      ...(parseOptionalBoolean(record.presente, 'presente') !== undefined
        ? { presente: parseOptionalBoolean(record.presente, 'presente') }
        : {}),
      ...(parseOptionalBoolean(record.vomitos, 'vomitos') !== undefined
        ? { vomitos: parseOptionalBoolean(record.vomitos, 'vomitos') }
        : {}),
      ...(parseOptionalBoolean(record.diarrea, 'diarrea') !== undefined
        ? { diarrea: parseOptionalBoolean(record.diarrea, 'diarrea') }
        : {}),
      ...(parseOptionalBoolean(record.nauseas, 'nauseas') !== undefined
        ? { nauseas: parseOptionalBoolean(record.nauseas, 'nauseas') }
        : {}),
      ...(parseOptionalBoolean(record.estrenimiento, 'estrenimiento') !== undefined
        ? { estrenimiento: parseOptionalBoolean(record.estrenimiento, 'estrenimiento') }
        : {}),
      ...(asociadoComida !== undefined ? { asociadoComida } : {}),
      ...(sanitizeTextListField(record.notas, 1200) !== undefined
        ? { notas: sanitizeTextListField(record.notas, 1200) }
        : {}),
    };

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  })();

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
    ...(perfilDolorAbdominal !== undefined ? { perfilDolorAbdominal } : {}),
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

export { sanitizeIdentificacionData } from './encounters-sanitize-intake.helpers';

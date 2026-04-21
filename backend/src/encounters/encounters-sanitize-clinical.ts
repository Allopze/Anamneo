import { BadRequestException } from '@nestjs/common';
import {
  sanitizeNumericStringField,
  sanitizePressureField,
  sanitizeStructuredMedication,
  sanitizeStructuredOrder,
  sanitizeText,
  sanitizeTextListField,
} from './encounters-sanitize-primitives';

const ESTADOS_RESPUESTA_TRATAMIENTO = ['FAVORABLE', 'PARCIAL', 'SIN_RESPUESTA', 'EMPEORA'] as const;
const ESTADOS_ADHERENCIA_TRATAMIENTO = ['ADHERENTE', 'PARCIAL', 'NO_ADHERENTE'] as const;
const SEVERIDADES_EVENTO_ADVERSO = ['LEVE', 'MODERADO', 'SEVERO'] as const;

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
  const resultadosTratamientos = (() => {
    const raw = data.resultadosTratamientos;
    if (raw === undefined || raw === null) {
      return undefined;
    }

    if (!Array.isArray(raw)) {
      throw new BadRequestException('Los resultados por tratamiento deben enviarse como arreglo');
    }

    const sanitized = raw
      .slice(0, 200)
      .map((item, index) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          throw new BadRequestException(`Resultado de tratamiento #${index + 1} inválido`);
        }

        const record = item as Record<string, unknown>;
        const treatmentItemId = sanitizeText(record.treatmentItemId, 100);
        if (!treatmentItemId) {
          throw new BadRequestException(`Resultado de tratamiento #${index + 1} requiere treatmentItemId`);
        }

        const estado = (() => {
          if (record.estado === undefined || record.estado === null || record.estado === '') {
            return undefined;
          }

          if (
            typeof record.estado !== 'string' ||
            !ESTADOS_RESPUESTA_TRATAMIENTO.includes(record.estado as (typeof ESTADOS_RESPUESTA_TRATAMIENTO)[number])
          ) {
            throw new BadRequestException(`El estado del resultado de tratamiento #${index + 1} no es válido`);
          }

          return record.estado;
        })();

        const notas = sanitizeTextListField(record.notas, 1000);
        const adherenceStatus = (() => {
          if (record.adherenceStatus === undefined || record.adherenceStatus === null || record.adherenceStatus === '') {
            return undefined;
          }

          if (
            typeof record.adherenceStatus !== 'string' ||
            !ESTADOS_ADHERENCIA_TRATAMIENTO.includes(record.adherenceStatus as (typeof ESTADOS_ADHERENCIA_TRATAMIENTO)[number])
          ) {
            throw new BadRequestException(`La adherencia del resultado de tratamiento #${index + 1} no es válida`);
          }

          return record.adherenceStatus;
        })();
        const adverseEventSeverity = (() => {
          if (record.adverseEventSeverity === undefined || record.adverseEventSeverity === null || record.adverseEventSeverity === '') {
            return undefined;
          }

          if (
            typeof record.adverseEventSeverity !== 'string' ||
            !SEVERIDADES_EVENTO_ADVERSO.includes(record.adverseEventSeverity as (typeof SEVERIDADES_EVENTO_ADVERSO)[number])
          ) {
            throw new BadRequestException(`La severidad del evento adverso #${index + 1} no es válida`);
          }

          return record.adverseEventSeverity;
        })();
        const adverseEventNotes = sanitizeTextListField(record.adverseEventNotes, 1000);

        if (!estado && !notas && !adherenceStatus && !adverseEventSeverity && !adverseEventNotes) {
          return null;
        }

        return {
          treatmentItemId,
          ...(estado !== undefined ? { estado } : {}),
          ...(notas !== undefined ? { notas } : {}),
          ...(adherenceStatus !== undefined ? { adherenceStatus } : {}),
          ...(adverseEventSeverity !== undefined ? { adverseEventSeverity } : {}),
          ...(adverseEventNotes !== undefined ? { adverseEventNotes } : {}),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return sanitized.length > 0 ? sanitized : undefined;
  })();

  const respuestaEstructurada = (() => {
    const raw = data.respuestaEstructurada;
    if (raw === undefined || raw === null) {
      return undefined;
    }

    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('La respuesta estructurada al tratamiento no es válida');
    }

    const record = raw as Record<string, unknown>;
    const estado = (() => {
      if (record.estado === undefined || record.estado === null || record.estado === '') {
        return undefined;
      }

      if (
        typeof record.estado !== 'string' ||
        !ESTADOS_RESPUESTA_TRATAMIENTO.includes(record.estado as (typeof ESTADOS_RESPUESTA_TRATAMIENTO)[number])
      ) {
        throw new BadRequestException('El estado estructurado de respuesta al tratamiento no es válido');
      }

      return record.estado;
    })();

    const notas = sanitizeTextListField(record.notas, 1000);
    const sanitized = {
      ...(estado !== undefined ? { estado } : {}),
      ...(notas !== undefined ? { notas } : {}),
    };

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  })();

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
    ...(respuestaEstructurada !== undefined ? { respuestaEstructurada } : {}),
    ...(resultadosTratamientos !== undefined ? { resultadosTratamientos } : {}),
  };
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

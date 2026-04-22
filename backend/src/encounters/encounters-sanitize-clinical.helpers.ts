import { BadRequestException } from '@nestjs/common';
import { sanitizeText, sanitizeTextListField } from './encounters-sanitize-primitives';

const ESTADOS_RESPUESTA_TRATAMIENTO = ['FAVORABLE', 'PARCIAL', 'SIN_RESPUESTA', 'EMPEORA'] as const;
const ESTADOS_ADHERENCIA_TRATAMIENTO = ['ADHERENTE', 'PARCIAL', 'NO_ADHERENTE'] as const;
const SEVERIDADES_EVENTO_ADVERSO = ['LEVE', 'MODERADO', 'SEVERO'] as const;

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

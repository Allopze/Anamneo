import { BadRequestException } from '@nestjs/common';
import { PREVISIONES, SEXOS } from '../common/types';
import { sanitizeText } from './encounters-sanitize-primitives';

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

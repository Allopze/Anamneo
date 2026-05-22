import * as fs from 'fs';
import * as path from 'path';
import * as request from 'supertest';
import { cookieHeader, prisma, req, state } from '../helpers/e2e-setup';

function asMedico(requestBuilder: request.Test) {
  return requestBuilder.set('Cookie', cookieHeader(state.medicoCookies));
}

async function expectStatusIn(label: string, call: () => request.Test, expectedStatuses: number[]) {
  const response = await call();
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${label} returned ${response.status}`);
  }
  return response;
}

export async function expectEncounterIdIsolation(params: {
  leakedEncounterId: string;
  leakedOpenEncounterId: string;
  medico2PatientId: string;
}) {
  const { leakedEncounterId, leakedOpenEncounterId, medico2PatientId } = params;
  const forbiddenOrNotFound = [403, 404];
  const cases: Array<{
    label: string;
    call: () => request.Test;
    assert?: (response: request.Response) => void;
  }> = [
    { label: 'export pdf', call: () => asMedico(req().get(`/api/encounters/${leakedEncounterId}/export/pdf`)) },
    { label: 'focused export', call: () => asMedico(req().get(`/api/encounters/${leakedEncounterId}/export/document/receta`)) },
    { label: 'duplicate', call: () => asMedico(req().post(`/api/encounters/${leakedEncounterId}/duplicate`)).send({}) },
    {
      label: 'patient timeline',
      call: () => asMedico(req().get(`/api/encounters/patient/${medico2PatientId}`)),
      assert: (response) => {
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      },
    },
    {
      label: 'update section',
      call: () => asMedico(req().put(`/api/encounters/${leakedOpenEncounterId}/sections/MOTIVO_CONSULTA`))
        .send({ data: { motivo: 'Intento fuera de scope' }, completed: true }),
    },
    { label: 'reconcile', call: () => asMedico(req().post(`/api/encounters/${leakedOpenEncounterId}/reconcile-identification`)).send({}) },
    {
      label: 'complete',
      call: () => asMedico(req().post(`/api/encounters/${leakedOpenEncounterId}/complete`))
        .send({ closureNote: 'Cierre fuera de scope' }),
    },
    {
      label: 'sign',
      call: () => asMedico(req().post(`/api/encounters/${leakedEncounterId}/sign`))
        .send({ password: 'Nueva.Clave123' }),
    },
    {
      label: 'reopen',
      call: () => asMedico(req().post(`/api/encounters/${leakedEncounterId}/reopen`))
        .send({ reasonCode: 'ERROR_DOCUMENTACION', note: 'Reapertura fuera de scope' }),
    },
    { label: 'cancel', call: () => asMedico(req().post(`/api/encounters/${leakedOpenEncounterId}/cancel`)).send({}) },
    {
      label: 'review status',
      call: () => asMedico(req().put(`/api/encounters/${leakedOpenEncounterId}/review-status`))
        .send({ reviewStatus: 'REVISADA_POR_MEDICO', note: 'Revision fuera de scope' }),
    },
    { label: 'audit', call: () => asMedico(req().get(`/api/encounters/${leakedEncounterId}/audit`)) },
  ];

  for (const item of cases) {
    const response = await item.call();
    if (item.assert) {
      item.assert(response);
      continue;
    }
    if (!forbiddenOrNotFound.includes(response.status)) {
      throw new Error(`${item.label} returned ${response.status}`);
    }
  }
}

export async function expectAttachmentIdIsolation(params: {
  leakedOpenEncounterId: string;
  medico2UserId: string;
}) {
  const { leakedOpenEncounterId, medico2UserId } = params;
  const uploadRoot = process.env.UPLOAD_DEST;
  if (!uploadRoot) throw new Error('UPLOAD_DEST must be configured for e2e isolation tests');

  fs.mkdirSync(uploadRoot, { recursive: true });
  const storedName = `leaked-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(uploadRoot, storedName), Buffer.from('%PDF-1.4\n% e2e isolation fixture\n'));

  const attachment = await prisma.attachment.create({
    data: {
      encounterId: leakedOpenEncounterId,
      filename: storedName,
      originalName: 'leaked.pdf',
      mime: 'application/pdf',
      size: 32,
      storagePath: storedName,
      uploadedById: medico2UserId,
    },
  });

  await asMedico(req().get(`/api/attachments/encounter/${leakedOpenEncounterId}`)).expect(404);
  await asMedico(req().get(`/api/attachments/${attachment.id}/download`)).expect(404);
  await asMedico(req().delete(`/api/attachments/${attachment.id}`)).expect(403);
}

export async function expectPatientIdIsolation(params: {
  medico2PatientId: string;
  ownPatientId: string;
}) {
  const { medico2PatientId, ownPatientId } = params;
  const forbiddenOrNotFound = [403, 404];
  const cases: Array<{ label: string; call: () => request.Test; expected?: number[] }> = [
    { label: 'admin summary', call: () => asMedico(req().get(`/api/patients/${medico2PatientId}/admin-summary`)) },
    { label: 'encounter timeline', call: () => asMedico(req().get(`/api/patients/${medico2PatientId}/encounters`)) },
    { label: 'operational history', call: () => asMedico(req().get(`/api/patients/${medico2PatientId}/operational-history`)) },
    { label: 'clinical summary', call: () => asMedico(req().get(`/api/patients/${medico2PatientId}/clinical-summary`)) },
    { label: 'export pdf', call: () => asMedico(req().get(`/api/patients/${medico2PatientId}/export/pdf`)) },
    { label: 'export bundle', call: () => asMedico(req().get(`/api/patients/${medico2PatientId}/export/bundle`)) },
    { label: 'regulatory export', call: () => asMedico(req().get(`/api/patients/${medico2PatientId}/export/regulatory`)) },
    {
      label: 'update demographics',
      call: () => asMedico(req().put(`/api/patients/${medico2PatientId}`)).send({ domicilio: 'Intento fuera de scope' }),
    },
    {
      label: 'update admin fields',
      call: () => asMedico(req().put(`/api/patients/${medico2PatientId}/admin`)).send({ domicilio: 'Intento fuera de scope' }),
    },
    {
      label: 'update history',
      call: () => asMedico(req().put(`/api/patients/${medico2PatientId}/history`))
        .send({ antecedentesMedicos: { texto: 'Intento fuera de scope' } }),
    },
    {
      label: 'merge from another medico patient',
      call: () => asMedico(req().post(`/api/patients/${ownPatientId}/merge`)).send({ sourcePatientId: medico2PatientId }),
      expected: [400, 403, 404],
    },
    {
      label: 'verify demographics',
      call: () => asMedico(req().post(`/api/patients/${medico2PatientId}/verify-demographics`)).send({}),
    },
    { label: 'restore', call: () => asMedico(req().post(`/api/patients/${medico2PatientId}/restore`)).send({}) },
    { label: 'delete', call: () => asMedico(req().delete(`/api/patients/${medico2PatientId}`)) },
    { label: 'purge', call: () => asMedico(req().delete(`/api/patients/${medico2PatientId}/purge`)) },
  ];

  for (const item of cases) {
    await expectStatusIn(item.label, item.call, item.expected ?? forbiddenOrNotFound);
  }

  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: medico2PatientId },
    select: { id: true, archivedAt: true },
  });
  expect(patient.archivedAt).toBeNull();
}

export async function expectTemplateAndLocalConditionIsolation(params: {
  medico2UserId: string;
}) {
  const { medico2UserId } = params;
  const template = await prisma.textTemplate.create({
    data: {
      medicoId: medico2UserId,
      name: 'Plantilla privada medico dos',
      category: 'GENERAL',
      content: 'Texto clinico privado',
      sectionKey: 'MOTIVO_CONSULTA',
    },
  });
  const localCondition = await prisma.conditionCatalogLocal.create({
    data: {
      medicoId: medico2UserId,
      name: 'Condicion privada medico dos',
    },
  });

  const templatesRes = await asMedico(req().get('/api/templates')).expect(200);
  expect(templatesRes.body.map((item: any) => item.id)).not.toContain(template.id);
  await asMedico(req().put(`/api/templates/${template.id}`).send({ name: 'Plantilla usurpada' })).expect(403);
  await asMedico(req().delete(`/api/templates/${template.id}`)).expect(403);

  const conditionsRes = await asMedico(req().get('/api/conditions?search=Condicion%20privada')).expect(200);
  expect(conditionsRes.body.map((item: any) => item.id)).not.toContain(localCondition.id);
  await asMedico(req().put(`/api/conditions/local/${localCondition.id}`).send({ name: 'Condicion usurpada' })).expect(404);
  await asMedico(req().delete(`/api/conditions/local/${localCondition.id}`)).expect(404);

  const [templateAfter, conditionAfter] = await prisma.$transaction([
    prisma.textTemplate.findUniqueOrThrow({ where: { id: template.id } }),
    prisma.conditionCatalogLocal.findUniqueOrThrow({ where: { id: localCondition.id } }),
  ]);
  expect(templateAfter.name).toBe(template.name);
  expect(conditionAfter.name).toBe(localCondition.name);
}

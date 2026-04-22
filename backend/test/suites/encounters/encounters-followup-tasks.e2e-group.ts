/// <reference types="jest" />

import { state, req, cookieHeader } from '../../helpers/e2e-setup';
import { DAY_IN_MS } from './encounters-followup.helpers';
import { extractDateOnlyIso, todayLocalDateOnly } from '../../../src/common/utils/local-date';

export function registerEncounterFollowupTasks() {
  it('POST /api/patients/:id/problems → create patient problem', async () => {
    const onsetDate = '2026-03-18';
    const res = await req()
      .post(`/api/patients/${state.patientId}/problems`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        label: 'Hipertension arterial',
        notes: 'Control pendiente',
        status: 'ACTIVO',
        onsetDate,
        encounterId: state.encounterId,
      })
      .expect(201);

    expect(res.body.label).toBe('Hipertension arterial');
    expect(res.body.onsetDate.slice(0, 10)).toBe(onsetDate);
    expect(res.body.medicoId).toBe(state.medicoUserId);
    state.patientProblemId = res.body.id;
  });

  it('PUT /api/patients/problems/:problemId → rejects invalid patient problem status', async () => {
    const res = await req()
      .put(`/api/patients/problems/${state.patientProblemId}`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        status: 'ESTADO_INVALIDO',
      })
      .expect(400);

    expect(String(res.body.message)).toContain('status');
  });

  it('PUT /api/patients/problems/:problemId → resolve patient problem', async () => {
    const res = await req()
      .put(`/api/patients/problems/${state.patientProblemId}`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        status: 'RESUELTO',
      })
      .expect(200);

    expect(res.body.status).toBe('RESUELTO');
  });

  it('POST /api/patients/:id/tasks → create patient task', async () => {
    const today = todayLocalDateOnly();
    const res = await req()
      .post(`/api/patients/${state.patientId}/tasks`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        title: 'Revisar examen de control',
        details: 'Llamar al paciente cuando llegue resultado',
        type: 'EXAMEN',
        priority: 'ALTA',
        dueDate: today,
        encounterId: state.encounterId,
      })
      .expect(201);

    expect(res.body.title).toBe('Revisar examen de control');
    expect(res.body.dueDate.slice(0, 10)).toBe(today);
    expect(res.body.medicoId).toBe(state.medicoUserId);
    expect(res.body.priority).toBe('ALTA');
    state.patientTaskId = res.body.id;
  });

  it('GET /api/patients/tasks → list task inbox', async () => {
    const res = await req()
      .get('/api/patients/tasks?search=Revisar')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.body.data.some((task: any) => task.id === state.patientTaskId)).toBe(true);
  });

  it('GET /api/patients?taskWindow=TODAY → filters patients by tasks due today', async () => {
    const res = await req()
      .get('/api/patients?taskWindow=TODAY')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.body.data.some((patient: any) => patient.id === state.patientId)).toBe(true);
  });

  it('GET /api/patients/tasks?priority=ALTA → filters task inbox by priority', async () => {
    const res = await req()
      .get('/api/patients/tasks?priority=ALTA')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.body.data.some((task: any) => task.id === state.patientTaskId)).toBe(true);
    expect(res.body.data.every((task: any) => task.priority === 'ALTA')).toBe(true);
  });

  it('GET /api/patients/tasks → admin gets 403 because the task inbox is clinical', async () => {
    await req().get('/api/patients/tasks?search=Revisar').set('Cookie', cookieHeader(state.adminCookies)).expect(403);
  });

  it('GET /api/patients/tasks?overdueOnly=true → does not mark tasks due today as overdue', async () => {
    const res = await req()
      .get('/api/patients/tasks?overdueOnly=true')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.body.data.some((task: any) => task.id === state.patientTaskId)).toBe(false);
  });

  it('POST /api/patients/:id/tasks → create a future follow-up used by operational filters', async () => {
    const nextWeekDate = extractDateOnlyIso(new Date(Date.now() + 3 * DAY_IN_MS));

    await req()
      .post(`/api/patients/${state.patientId}/tasks`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        title: 'Control programado de la semana',
        type: 'SEGUIMIENTO',
        priority: 'MEDIA',
        dueDate: nextWeekDate,
      })
      .expect(201);
  });

  it('POST /api/patients/:id/tasks → create an administrative task without due date', async () => {
    await req()
      .post(`/api/patients/${state.patientId}/tasks`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        title: 'Completar autorización administrativa',
        type: 'TRAMITE',
        priority: 'BAJA',
      })
      .expect(201);
  });

  it('POST /api/patients/:id/tasks → create an administrative task due this week', async () => {
    const dueSoonDate = extractDateOnlyIso(new Date(Date.now() + 2 * DAY_IN_MS));

    await req()
      .post(`/api/patients/${state.patientId}/tasks`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        title: 'Regularizar orden administrativa',
        type: 'TRAMITE',
        priority: 'MEDIA',
        dueDate: dueSoonDate,
      })
      .expect(201);
  });

  it('GET /api/patients?taskWindow=THIS_WEEK → filters patients by tasks due this week', async () => {
    const res = await req()
      .get('/api/patients?taskWindow=THIS_WEEK')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.body.data.some((patient: any) => patient.id === state.patientId)).toBe(true);
  });

  it('GET /api/patients?taskWindow=NO_DUE_DATE → filters patients by active tasks without due date', async () => {
    const res = await req()
      .get('/api/patients?taskWindow=NO_DUE_DATE')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.body.data.some((patient: any) => patient.id === state.patientId)).toBe(true);
  });

  it('GET /api/encounters/stats/dashboard → exposes operational reminder counts for due tasks and administrative work', async () => {
    const res = await req()
      .get('/api/encounters/stats/dashboard')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.body.counts.dueTodayTasks).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.dueThisWeekTasks).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.upcomingAdministrativeTasks).toBeGreaterThanOrEqual(1);
  });

  it('PUT /api/patients/tasks/:taskId → update patient task', async () => {
    // Use a date safely in the past to avoid UTC/local boundary flakes around midnight.
    const overdueDate = extractDateOnlyIso(new Date(Date.now() - 48 * 60 * 60 * 1000));
    const res = await req()
      .put(`/api/patients/tasks/${state.patientTaskId}`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        title: 'Revisar examen de control actualizado',
        status: 'EN_PROCESO',
        dueDate: overdueDate,
      })
      .expect(200);

    expect(res.body.title).toBe('Revisar examen de control actualizado');
    expect(res.body.status).toBe('EN_PROCESO');
    expect(res.body.dueDate.slice(0, 10)).toBe(overdueDate);
  });

  it('GET /api/patients/tasks?overdueOnly=true → includes tasks whose due date already passed', async () => {
    const res = await req()
      .get('/api/patients/tasks?overdueOnly=true')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    const task = res.body.data.find((item: any) => item.id === state.patientTaskId);
    expect(task).toBeDefined();
    expect(task.isOverdue).toBe(true);
  });

  it('GET /api/patients?taskWindow=OVERDUE → filters patients by overdue tasks', async () => {
    const res = await req()
      .get('/api/patients?taskWindow=OVERDUE')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.body.data.some((patient: any) => patient.id === state.patientId)).toBe(true);
  });

  it('GET /api/patients/tasks?status=COMPLETADA&overdueOnly=true → keeps filter semantics and returns empty', async () => {
    const res = await req()
      .get('/api/patients/tasks?status=COMPLETADA&overdueOnly=true')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('POST /api/attachments/encounter/:id → upload exam result linked to structured order', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const res = await req()
      .post(`/api/attachments/encounter/${state.encounterId}`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .field('category', 'EXAMEN')
      .field('description', 'Resultado recibido por laboratorio')
      .field('linkedOrderType', 'EXAMEN')
      .field('linkedOrderId', 'exam-hemograma')
      .attach('file', pdfBuffer, {
        filename: 'hemograma.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(res.body.originalName).toBe('hemograma.pdf');
    expect(res.body.linkedOrderType).toBe('EXAMEN');
    expect(res.body.linkedOrderId).toBe('exam-hemograma');
    expect(res.body.linkedOrderLabel).toBe('Hemograma completo');
    state.attachmentId = res.body.id;
  });

  it('GET /api/attachments/encounter/:id → returns linked attachment metadata', async () => {
    const res = await req()
      .get(`/api/attachments/encounter/${state.encounterId}`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    const attachment = res.body.find((item: any) => item.id === state.attachmentId);
    expect(attachment).toBeDefined();
    expect(attachment.linkedOrderType).toBe('EXAMEN');
    expect(attachment.linkedOrderLabel).toBe('Hemograma completo');
  });

  it('GET /api/attachments/:id/download → returns binary file', async () => {
    const res = await req()
      .get(`/api/attachments/${state.attachmentId}/download`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('hemograma.pdf');
  });


}

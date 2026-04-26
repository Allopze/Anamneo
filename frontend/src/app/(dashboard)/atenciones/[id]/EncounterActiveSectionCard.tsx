'use client';

import clsx from 'clsx';
import { FiCheck, FiChevronLeft, FiChevronRight, FiSlash } from 'react-icons/fi';
import type {
  AnamnesisRemotaData,
  Encounter,
  MotivoConsultaData,
  SectionKey,
  SospechaDiagnosticaData,
  TratamientoData,
} from '@/types';
import TemplateSelector from '@/components/TemplateSelector';
import { getSectionData } from '@/lib/clinical';
import {
  REQUIRED_SEMANTIC_SECTIONS,
  SURFACE_PANEL_CLASS,
} from './encounter-wizard.constants';

type Props = {
  wiz: any;
  encounter: Encounter;
  sections: NonNullable<Encounter['sections']>;
  currentSection: NonNullable<Encounter['sections']>[number] | undefined;
  currentSectionIndex: number;
  SectionComponent: any;
  formData: Record<string, unknown>;
};

export default function EncounterActiveSectionCard({
  wiz,
  encounter,
  sections,
  currentSection,
  currentSectionIndex,
  SectionComponent,
  formData,
}: Props) {
  const activeSection = currentSection ?? sections[currentSectionIndex];

  return (
    <section className={SURFACE_PANEL_CLASS}>
      <div className="border-b border-surface-muted/40 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
              <span>
                Sección {currentSectionIndex + 1} de {sections.length}
              </span>
              {!wiz.currentSectionStatusMeta.hidden && (
                <span className={clsx('flex items-center gap-2', wiz.currentSectionStatusMeta.badgeClassName)}>
                  <span className={clsx('h-1.5 w-1.5 rounded-full', wiz.currentSectionStatusMeta.dotClassName)} />
                  {wiz.currentSectionStatusMeta.label}
                </span>
              )}
              {wiz.isSectionSwitchPending ? <span>Cambiando sección…</span> : null}
            </div>
            <h2 className="mt-2 text-[1.7rem] font-extrabold tracking-tight text-ink">
              {currentSection?.label}
            </h2>
          </div>

          {wiz.canEdit && wiz.supportsTemplates && currentSection ? (
            <TemplateSelector
              sectionKey={currentSection.sectionKey}
              onInsert={wiz.insertTemplateIntoCurrentSection}
            />
          ) : null}
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {SectionComponent && activeSection ? (
            <SectionComponent
              data={formData[activeSection.sectionKey] || {}}
              onChange={(data: unknown) => wiz.handleSectionDataChange(activeSection.sectionKey, data)}
              encounter={encounter}
              readOnly={!wiz.canEdit || activeSection.sectionKey === 'IDENTIFICACION'}
              snapshotStatus={
                activeSection.sectionKey === 'IDENTIFICACION' ? wiz.identificationSnapshotStatus : undefined
              }
              onRestoreFromPatient={
                activeSection.sectionKey === 'IDENTIFICACION' && wiz.canEdit
                  ? wiz.handleRestoreIdentificationFromPatient
                  : undefined
              }
              patientId={encounter.patientId}
              canEditPatientHistory={wiz.canEditAntecedentes()}
              linkedAttachmentsByOrderId={wiz.linkedAttachmentsByOrderId}
              onRequestAttachToOrder={wiz.handleStartLinkedAttachment}
              onPreviewAttachment={wiz.setPreviewAttachment}
              patientAge={wiz.identificationData.edad ?? encounter.patient?.edad}
              patientAgeMonths={wiz.identificationData.edadMeses ?? encounter.patient?.edadMeses}
              patientSexo={wiz.identificationData.sexo ?? encounter.patient?.sexo}
              motivoConsultaData={
                activeSection.sectionKey === 'SOSPECHA_DIAGNOSTICA'
                  ? ((formData.MOTIVO_CONSULTA as MotivoConsultaData | undefined) ?? getSectionData<MotivoConsultaData>(encounter, 'MOTIVO_CONSULTA'))
                  : undefined
              }
              allergyData={
                activeSection.sectionKey === 'TRATAMIENTO'
                  ? ((formData.ANAMNESIS_REMOTA as AnamnesisRemotaData | undefined)?.alergias ??
                    getSectionData<AnamnesisRemotaData>(encounter, 'ANAMNESIS_REMOTA')?.alergias)
                  : undefined
              }
              diagnosticData={
                activeSection.sectionKey === 'TRATAMIENTO'
                  ? ((formData.SOSPECHA_DIAGNOSTICA as SospechaDiagnosticaData | undefined) ??
                    getSectionData<SospechaDiagnosticaData>(encounter, 'SOSPECHA_DIAGNOSTICA'))
                  : undefined
              }
              treatmentData={
                activeSection.sectionKey === 'RESPUESTA_TRATAMIENTO'
                  ? ((formData.TRATAMIENTO as TratamientoData | undefined) ??
                    getSectionData<TratamientoData>(encounter, 'TRATAMIENTO'))
                  : undefined
              }
            />
          ) : (
            <div className="rounded-card border border-surface-muted/40 bg-surface-base/55 px-5 py-5 text-sm text-ink-secondary">
              No hay una sección activa para mostrar.
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-frame/12 bg-surface-base/25 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => wiz.handleNavigate('prev')}
            disabled={currentSectionIndex === 0}
            className="toolbar-btn"
          >
            <FiChevronLeft className="h-4 w-4" />
            Anterior
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {wiz.canEdit &&
            currentSection?.sectionKey !== 'IDENTIFICACION' &&
            !REQUIRED_SEMANTIC_SECTIONS.includes(currentSection?.sectionKey as SectionKey) ? (
              <button
                onClick={wiz.handleMarkNotApplicable}
                disabled={
                  wiz.saveSectionMutation.isPending ||
                  currentSection?.completed ||
                  currentSection?.notApplicable
                }
                className="toolbar-btn"
                title="Marcar esta sección como no aplica para este paciente"
              >
                <FiSlash className="h-4 w-4" />
                No aplica
              </button>
            ) : null}

            {currentSectionIndex < sections.length - 1 ? (
              <button onClick={() => wiz.handleNavigate('next')} className="toolbar-btn-primary">
                Siguiente
                <FiChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() =>
                  currentSection && wiz.persistSection({ sectionKey: currentSection.sectionKey, completed: true })
                }
                disabled={wiz.saveSectionMutation.isPending || currentSection?.completed || !wiz.canEdit}
                className="toolbar-btn-primary"
                title="Marcar como completa y guardar los últimos cambios"
              >
                Completar
                <FiCheck className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

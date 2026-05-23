export type PatientPortalRequestUser = {
  id: string;
  email: string;
  patientId: string;
  relationship: string;
  sessionId?: string;
};

export type PatientPortalJwtPayload = {
  sub: string;
  email: string;
  typ: 'patient_portal';
  sid?: string;
  sv?: number;
  rv?: number;
};

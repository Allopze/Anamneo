export type RequestUser = {
    id: string;
    role: string;
    medicoId?: string | null;
};
export declare function getEffectiveMedicoId(user: RequestUser): string;

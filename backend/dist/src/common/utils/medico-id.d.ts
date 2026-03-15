export type RequestUser = {
    id: string;
    role: string;
    isAdmin?: boolean;
    medicoId?: string | null;
};
export declare function getEffectiveMedicoId(user: RequestUser): string;

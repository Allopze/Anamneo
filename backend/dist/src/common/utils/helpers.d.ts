export declare function validateRut(rut: string): {
    valid: boolean;
    formatted: string | null;
};
export declare function sanitizeString(input: string): string;
export declare function calculateBMI(weightKg: number, heightCm: number): number | null;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRut = validateRut;
exports.sanitizeString = sanitizeString;
exports.calculateBMI = calculateBMI;
function validateRut(rut) {
    if (!rut || typeof rut !== 'string') {
        return { valid: false, formatted: null };
    }
    const cleanRut = rut.replace(/[.\-]/g, '').toUpperCase();
    if (cleanRut.length < 2) {
        return { valid: false, formatted: null };
    }
    const body = cleanRut.slice(0, -1);
    const verifier = cleanRut.slice(-1);
    if (!/^\d+$/.test(body)) {
        return { valid: false, formatted: null };
    }
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i], 10) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const remainder = 11 - (sum % 11);
    let expectedVerifier;
    if (remainder === 11) {
        expectedVerifier = '0';
    }
    else if (remainder === 10) {
        expectedVerifier = 'K';
    }
    else {
        expectedVerifier = remainder.toString();
    }
    const valid = verifier === expectedVerifier;
    if (!valid) {
        return { valid: false, formatted: null };
    }
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formatted = `${formattedBody}-${verifier}`;
    return { valid: true, formatted };
}
function sanitizeString(input) {
    if (typeof input !== 'string') {
        return '';
    }
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim();
}
function calculateBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || heightCm <= 0) {
        return null;
    }
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    return Math.round(bmi * 10) / 10;
}
//# sourceMappingURL=helpers.js.map
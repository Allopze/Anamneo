"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonArray = parseJsonArray;
function parseJsonArray(value) {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=parse-json-array.js.map
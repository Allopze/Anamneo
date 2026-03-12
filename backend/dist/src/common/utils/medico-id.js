"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectiveMedicoId = getEffectiveMedicoId;
const common_1 = require("@nestjs/common");
function getEffectiveMedicoId(user) {
    if (!user) {
        throw new common_1.ForbiddenException('Usuario no autenticado');
    }
    if (user.role === 'MEDICO')
        return user.id;
    if (user.role === 'ASISTENTE' && user.medicoId)
        return user.medicoId;
    throw new common_1.ForbiddenException('Asistente no asignado a un médico');
}
//# sourceMappingURL=medico-id.js.map